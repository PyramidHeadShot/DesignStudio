import { defineConfig } from 'astro/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// Волна Z: админка Keystatic — только в dev (static build без adapter не может
// иметь SSR-роутов: официальный плагин @keystatic/astro инжектит prerender:false
// и ломает билд). Роуты /keystatic и /api/keystatic инжектятся ТОЛЬКО при dev;
// в проде админка недоступна (данные правятся локально и коммитятся).
// Открыть: http://localhost:4321/keystatic (без base-префикса!).
function keystaticDev() {
  return {
    name: 'keystatic-dev-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, command, config }) => {
        if (command === 'dev') {
          // Мост base-пути для UI Keystatic (см. большой комментарий ниже):
          // unshift-им рерайтер в САМОЕ начало connect-стека через post-hook
          // configureServer — так он оказывается ПЕРЕД baseMiddleware Astro,
          // который иначе 404-ит html-запросы вне base (порядок проверен
          // по исходникам astro/dist/vite-plugin-astro-server/plugin.js).
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
                            req.url = '/DesignStudio' + u;
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
          // резолвер virtual:keystatic-config (как в официальном плагине)
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
              // Скан-файл как у официального плагина @keystatic/astro: заставляет
              // esbuild пройтись по ВСЕМУ графу Keystatic (включая raw-subpath'и
              // react-aria/react-stately и CJS-транзитивки) и пре-бандлить их
              // единообразно. Без него часть графа грузится сырьём → дубли
              // React-контекстов («outside of KeystarProvider») в редакторе кейса.
              optimizeDeps: {
                entries: ['keystatic.config.*', '.astro/keystatic-imports.js'],
              },
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
          // Роутер Keystatic жёстко зашит на путь /keystatic (RouterProvider в
          // @keystatic/core стрипает /^\/keystatic\/?/), а API-запросы UI идут на
          // абсолютный /api/keystatic/... — оба без base-префикса. Astro dev при
          // base '/DesignStudio' 404-ит html-навигацию вне base (baseMiddleware).
          // Мост keystatic-base-bridge (выше) рерайтит «чистые» пути на base-путь
          // до baseMiddleware, а тот их стрипает обратно — Astro видит обычный
          // внутренний путь, браузер — /keystatic, как ожидает роутер Keystatic.
          injectRoute({
            // своя обёртка над официальной страницей: добавляет панель предпросмотра
            // (см. src/keystatic/keystatic-page.astro)
            entrypoint: './src/keystatic/keystatic-page.astro',
            pattern: '/keystatic/[...params]',
            prerender: false,
          });
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
