import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Коллекция кейсов: MDX-файлы в src/content/cases
const cases = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/cases' }),
  // image() приходит в схему-функцию (Astro 5): резолвит относительный путь к обложке
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      client: z.string().optional(),
      year: z.number().optional(), // pentagram год не публикует — для тест-данных не указываем
      category: z.string(),
      cover: image().optional(), // обложка кейса (astro:assets), путь относительно MDX-файла
      featured: z.boolean().default(false),
      order: z.number().default(999),
    }),
});

export const collections = { cases };
