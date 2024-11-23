import { EleventyI18nPlugin } from "@11ty/eleventy";
import faviconsPlugin from "eleventy-plugin-gen-favicons";
import { readFileSync } from "fs";
import path from "path";
import SassHandler from "./src/_11ty/handlers/SassHandler.js";
import include_partial from "./src/_11ty/shortcodes/include_partial.js";
import html_prettify from "./src/_11ty/transforms/html_prettify.js";

export default function (eleventyConfig) {
    eleventyConfig.ignores.add("./src/_assets/js/**/*");

    // globals
    eleventyConfig.addGlobalData("layout", "layouts/site.njk");
    eleventyConfig.addGlobalData("type", "default");

    // plugins
    eleventyConfig.addPlugin(faviconsPlugin, {});
    eleventyConfig.addPlugin(EleventyI18nPlugin, {
        defaultLanguage: "fr",
        errorMode: "allow-fallback"
    })

    // scss handlers
    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", SassHandler);

    // shortCodes
    eleventyConfig.addPlugin(include_partial, {});

    // transforms
    eleventyConfig.addTransform("htmlprettify", html_prettify);

    // bundles
    eleventyConfig.addBundle("javascript", {
        toFileDirectory: "js",
        outputFileExtension: "js",
    });

    eleventyConfig.addBundle("css", {
        toFileDirectory: "css",
        outputFileExtension: "css",
    });

    // node.js libraries
    let pkg = JSON.parse(readFileSync(path.resolve("./package.json")));
    for (let bundle in pkg.bundleDependencies) {
        let dir = path.join("node_modules", pkg.bundleDependencies[bundle])
        eleventyConfig.addPassthroughCopy(dir);
        console.log(dir);
    }

    // 11ty configuration
    return {
        dir: {
            input: "src",
            output: "_site",
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
    };
};
