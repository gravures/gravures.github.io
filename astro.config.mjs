// @ts-check
// @ts-ignore
import mdx from "@astrojs/mdx";
import favicons from "astro-favicons";
import { defineConfig } from "astro/config";


export default defineConfig({
    site: "https://www.ideographe.fr",
    i18n: {
        locales: ["en", "fr"],
        defaultLocale: "fr",
        // SSR only:
        // fallback: { en: "fr" },
        // routing: { fallbackType: "rewrite" }
    },
    compressHTML: false,
    integrations: [
        mdx(),
        favicons(),
    ],
    build: {
        inlineStylesheets: `auto`,
    },
    output: 'static',
    experimental: {
        contentIntellisense: true,
    },
});
