import { defineCollection, z } from 'astro:content';

// 定义 about 集合
const aboutCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.boolean().default(true),
  }),
});

// 定义 research 集合
const researchCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.boolean().default(true),
    date: z.date().optional(),
  }),
});

export const collections = {
  about: aboutCollection,
  research: researchCollection,
};
