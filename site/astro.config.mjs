import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  // GitHub Pages: репозиторий PyramidHeadShot/DesignStudio → базовый путь /DesignStudio
  // (меняется на '/' при переходе на кастомный домен)
  site: 'https://pyramidheadshot.github.io',
  base: '/DesignStudio',
});
