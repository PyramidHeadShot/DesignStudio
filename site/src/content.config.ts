import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Волна Z: кейсы — YAML-файлы Keystatic (админка пишет их сама).
// glob loader по *.yaml; id записи = имя файла без расширения (= слаг).
const cases = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    category: z.string(),
    order: z.number().default(99),
    cover: z.string(), // путь в public (/images/cases/...)
    gallery: z.array(z.string()).default([]),
    body: z.string(), // авторский текст заказчика (дословно)
  }),
});

export const collections = { cases };
