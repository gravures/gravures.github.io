import { file, glob } from "astro/loaders"
import { defineCollection, z } from "astro:content"
import { syncLoader } from "../frontmatter/frontmatter.integration"


// TYPES
const content = z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    status: z.enum(["draft", "published", "deleted"]),
    layout: z.string().optional(),
})

const image = z.object({
    src: z.string(),
    alt: z.string(),
})

const article = content.extend({
    tags: z.array(z.string()).optional(),
    footnote: z.string().optional(),
})

const document = content.extend({
    id: z.string(),
    date: z.string().transform((str) => new Date(str)),
    src: z.string(),
    alt: z.string(),
    media: z.enum(["image", "video", "pdf"]),
    mode: z.enum(["image", "document"]),
    credits: z.string(),
})

// COLLECTIONS
const posters = defineCollection({
    loader: syncLoader(document, file, "src/data/documents/posters.json"),
    schema: document,
})

const root = defineCollection({
    loader: syncLoader(article, glob, { pattern: "*.mdx", base: "./src/content/root" }),
    schema: article,
})

const articles = defineCollection({
    loader: syncLoader(article, glob, { pattern: "*.mdx", base: "./src/content/articles" }),
    schema: article,
})

export const collections = { root, articles, posters }
