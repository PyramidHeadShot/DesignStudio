import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  // GitHub Pages: репозиторий PyramidHeadShot/DesignStudio → базовый путь /DesignStudio
  // (меняется на '/' при переходе на кастомный домен)
  site: 'https://pyramidheadshot.github.io',
  base: '/DesignStudio',
  // Волна S: современный таргет esbuild — без транспиляции для legacy-браузеров
  // (трейс показывал ~34KB wasted на downleveling); Chrome 94+/Safari 15+
  vite: { build: { target: 'es2022' } },
});
