import { glob } from "astro/loaders"
import { defineCollection, z } from "astro:content"
import { MediaDbSync, syncLoader } from "../frontmatter/frontmatter.integration"


// TYPES
const content = z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    status: z.enum(["draft", "published", "deleted"]),
    layout: z.string().optional(),
})

const article = content.extend({
    tags: z.array(z.string()).optional(),
    footnote: z.string().optional(),
})

const image = z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    alt: z.string(),
    date: z.string().transform((str) => new Date(str)),
    credits: z.string(),
    status: z.enum(["draft", "published", "deleted"]),
    layout: z.string().optional(),
})

// COLLECTIONS
const root = defineCollection({
    loader: new syncLoader(article, glob, { pattern: "*.mdx", base: "./src/content/root" }),
    schema: article,
})

const articles = defineCollection({
    loader: new syncLoader(article, glob, { pattern: "*.mdx", base: "./src/content/articles" }),
    schema: article,
})

MediaDbSync.setSchema(image)
const posters = defineCollection({
    loader: new MediaDbSync("src/data/posters.json", "src/assets/img/posters"),
})

export const collections = { root, articles, posters }
