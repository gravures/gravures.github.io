import { readFileSync } from "fs";
import path from "path";

import { EleventyI18nPlugin, EleventyRenderPlugin } from "@11ty/eleventy";
import pluginWebc from "@11ty/eleventy-plugin-webc";
import faviconsPlugin from "eleventy-plugin-gen-favicons";

import SassHandler from "./src/_11ty/handlers/SassHandler.js";
import partial from "./src/_11ty/shortcodes/partial.js";
import html_prettify from "./src/_11ty/transforms/html_prettify.js";



/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default function (eleventyConfig) {
    // ignores
    eleventyConfig.ignores.add("./src/_assets/js/**/*");

    // globals
    eleventyConfig.addGlobalData("layout", "layouts/site.njk");
    eleventyConfig.addGlobalData("type", "default");

    // plugins
    eleventyConfig.addPlugin(EleventyI18nPlugin, {
        defaultLanguage: "fr",
        errorMode: "allow-fallback"
    });
    eleventyConfig.addPlugin(EleventyRenderPlugin);
    eleventyConfig.addPlugin(pluginWebc, {
        components: "./src/_includes/components/**/*.webc",
    });
    eleventyConfig.addPlugin(faviconsPlugin, {});

    // shortCodes
    eleventyConfig.addPlugin(partial, {});

    // scss handlers
    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", SassHandler);

    // transforms
    eleventyConfig.addTransform("htmlprettify", html_prettify);

    // node.js libraries
    let pkg = JSON.parse(readFileSync(path.resolve("./package.json")));
    for (let bundle in pkg.bundleDependencies) {
        let dir = path.join("node_modules", pkg.bundleDependencies[bundle]);
        eleventyConfig.addPassthroughCopy(dir);
        console.log(dir);
    }
};


export const config = {
    // Control which files Eleventy will process
    templateFormats: [
        "md",
        "njk",
        "html",
        "liquid",
        "11ty.js",
    ],

    // Pre-process *.md files with
    markdownTemplateEngine: "njk",

    // Pre-process *.html files with:
    htmlTemplateEngine: "njk",

    dir: {
        input: "src",
        output: "_site",
    },
};
