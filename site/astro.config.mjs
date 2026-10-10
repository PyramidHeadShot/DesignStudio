import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// Волна Z: админка Keystatic — только в dev (static build без adapter не может
// иметь SSR-роутов: официальный плагин @keystatic/astro инжектит prerender:false
// и ломает билд). Роуты /admin и /api/keystatic инжектятся ТОЛЬКО при dev;
// в проде админка недоступна (данные правятся локально и коммитятся).
function keystaticDev() {
  return {
    name: 'keystatic-dev-routes',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, command }) => {
        if (command === 'dev') {
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
            },
          });
          injectRoute({
            entrypoint: '@keystatic/astro/internal/keystatic-astro-page.astro',
            pattern: '/admin/[...params]',
            prerender: false,
          });
          injectRoute({
            entrypoint: 'C:/Yandex.Disk/DesignStudio/site/src/keystatic/keystatic-api.ts',
            pattern: '/api/keystatic/tree',
            prerender: false,
          });
          injectRoute({
            entrypoint: './src/keystatic/keystatic-update.ts',
            pattern: '/api/keystatic/update',
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
  vite: { build: { target: 'es2022' } },
});
