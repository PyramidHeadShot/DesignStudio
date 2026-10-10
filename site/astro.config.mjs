import { defineConfig } from 'astro/config';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// Волна Z→AO: админка Keystatic.
// — Страница админки — обычный файл src/pages/keystatic.astro (статика в проде,
//   работает и в dev): с GitHub-хранилищем серверные роуты не нужны.
// — В dev дополнительно инжектятся API-роуты /api/keystatic/* (local-хранилище
//   пишет файлы на диск) и работает мост base-пути (роутер Keystatic зашит на
//   «/keystatic», а Astro с base '/DesignStudio' отдаёт html только по base-пути).
// — В build патчим строки «/keystatic» в dist @keystatic/core на base-путь,
//   иначе на GitHub Pages роутер показывает «Not found».
// Открыть в dev: http://localhost:4321/keystatic (без base-префикса!).
function keystaticDev() {
  return {
    name: 'keystatic-dev-routes',
    hooks: {
      // Волна AP: GitHub Pages не умеет SPA-роуты — OAuth-колбэк Keystatic Cloud
      // ({base}/keystatic/cloud/oauth/callback) отдаём как реальную страницу
      // (копия админки; её роутер сам обработает маршрут).
      'astro:build:done': ({ dir }) => {
        const admin = new URL('keystatic/index.html', dir);
        const dest = new URL('keystatic/cloud/oauth/callback/', dir);
        mkdirSync(dest, { recursive: true });
        copyFileSync(admin, new URL('index.html', dest));
      },
      'astro:config:setup': ({ injectRoute, updateConfig, command, config }) => {
        const base = config.base.replace(/\/+$/, '');

        // Волна AO: патч base-пути для прод-сборки (роутер и ссылки Keystatic)
        if (command === 'build' && base !== '/') {
          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'keystatic-base-patch',
                  transform(code, id) {
                    if (!id.includes(`@keystatic/core/dist/`)) return null;
                    const baseRe = base.split('/').join(`\\/`);
                    let out = code
                      .replaceAll('"/keystatic', `"${base}/keystatic`)
                      .replaceAll("'/keystatic", `'${base}/keystatic`)
                      .replaceAll('`/keystatic/cloud/oauth/callback', `'${base}/keystatic/cloud/oauth/callback`)
                      .replaceAll('}/keystatic/cloud/oauth/callback', '}' + base + '/keystatic/cloud/oauth/callback')
                      .replaceAll('`/keystatic', '`' + base + '/keystatic')
                      .split(`/^\\/keystatic\\/?/`).join(`/^(?:${baseRe})?\\/keystatic\\/?|\\/$/g`);
                    return out === code ? null : { code: out, map: null };
                  },
                },
              ],
            },
          });
        }

        // резолвер virtual:keystatic-config — в dev И в build (страница админки статическая)
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'keystatic-config-resolver',
                resolveId(id) {
                  if (id === 'virtual:keystatic-config') return this.resolve('./keystatic.config', './a');
                  return null;
                },
              },
            ],
          },
        });

        if (command === 'dev') {
          // Мост base-пути для UI Keystatic: unshift-им рерайтер в САМОЕ начало
          // connect-стека через post-hook configureServer — так он оказывается
          // ПЕРЕД baseMiddleware Astro, который иначе 404-ит html-запросы вне base
          // (порядок проверен по исходникам astro/dist/vite-plugin-astro-server/plugin.js).
          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'keystatic-base-bridge',
                  configureServer(server) {
                    return () => {
                      server.middlewares.stack.unshift({
                        route: '',
                        handle(req, res, next) {
                          const u = req.url || '';
                          if (u === '/keystatic' || u.startsWith('/keystatic/') ||
                              u === '/api/keystatic' || u.startsWith('/api/keystatic/')) {
                            req.url = base + u;
                          }
                          next();
                        },
                      });
                    };
                  },
                },
              ],
            },
          });

          // Скан-файл импортов (создаётся при каждом dev-старте, как в официальном плагине)
          const dotAstroDir = new URL('./.astro/', config.root);
          mkdirSync(dotAstroDir, { recursive: true });
          writeFileSync(
            new URL('keystatic-imports.js', dotAstroDir),
            // только клиентский граф: @keystatic/astro/api тянет 'astro:env/server',
            // который esbuild-сканер не резолвит (виртуальный модуль Astro); серверные
            // зависимости и так приходят через keystatic.config.* (см. entries выше)
            'import "@keystatic/astro/ui";\nimport "@keystatic/core/ui";\n'
          );
          // Страница админки — обычный файл src/pages/keystatic.astro (статика).
          // Инжектятся только API-роуты local-хранилища (dev).
          injectRoute({
            entrypoint: 'C:/Yandex.Disk/DesignStudio/site/src/keystatic/keystatic-api.ts',
            // catch-all обязателен: UI Keystatic дергает не только tree/update,
            // но и blob/<sha>/<filepath> для чтения файлов (иначе карточки кейсов
            // падают с «Could not fetch blob»); роутинг по суффиксу делает сам
            // makeGenericAPIRouteHandler внутри keystatic-api.ts
            pattern: '/api/keystatic/[...params]',
            prerender: false,
          });
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react(), keystaticDev()],
  // GitHub Pages: репозиторий PyramidHeadShot/DesignStudio → базовый путь /DesignStudio
  // (меняется на '/' при переходе на кастомный домен)
  site: 'https://pyramidheadshot.github.io',
  base: '/DesignStudio',
  // Волна S: современный таргет esbuild — без транспиляции для legacy-браузеров
  // (трейс показывал ~34KB wasted на downleveling); Chrome 94+/Safari 15+
  vite: {
    build: { target: 'es2022' },
    // Админка Keystatic (dev): часть React-зависимостей Keystatic/Keystar отдаётся
    // Vite как сырые исходники (не проходят dep-скан), а их CJS-транзитивки
    // не имеют ESM-обёртки → SyntaxError "does not provide an export named ...".
    // Явное включение прогоняет их через esbuild-пре-бандлинг.
    optimizeDeps: {
      include: [
        'slate-react',
        'lodash',
        'lodash/debounce',
        'lodash/throttle',
        'react-aria',
        'react-stately',
        'use-sync-external-store',
        // react-aria/dist/private/* грузится Vite сырыми исходниками и импортирует
        // именно subpath-и shim'а — их нужно пре-бандлить отдельно от корня пакета.
        'use-sync-external-store/shim',
        'use-sync-external-store/shim/index.js',
        // CJS-транзитивки графа @keystatic/core (сырые dist-файлы импортируют их).
        'cookie',
        'is-hotkey',
        '@braintree/sanitize-url',
        '@sindresorhus/slugify',
        'fast-deep-equal',
        'js-yaml',
        'superstruct',
        'emery',
        'lru-cache',
        'idb-keyval',
        'match-sorter',
        'minimatch',
        'escape-string-regexp',
        'yjs',
        'y-protocols/sync',
        'y-protocols/awareness',
        'y-protocols/auth',
        'lib0/encoding',
        'lib0/decoding',
        'lib0/math',
        'lib0/time',
        'lib0/mutex',
        'lib0/broadcastchannel',
        'urql',
        '@urql/exchange-graphcache',
        '@urql/exchange-auth',
        '@urql/exchange-persisted',
        'debug',
        'slate',
        'slate-dom',
        'slate-history',
        'prismjs',
        // CJS-модуль без ESM-обёртки: при сырой отдаче падает гидрация
        // «does not provide an export named 'default'».
        'acorn-jsx',
      ],
    },
  },
});
