import { readFileSync } from "fs";
import path from "path";

import { EleventyI18nPlugin, EleventyRenderPlugin } from "@11ty/eleventy";
import EleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import FaviconsPlugin from "eleventy-plugin-gen-favicons";

import CssTransformPlugin, { cssTransform } from "./src/_11ty/plugins/CssTransform.js";
import HtmlPrettifierPlugin from "./src/_11ty/plugins/HtmlPrettifier.js";
import PartialRenderPlugin from "./src/_11ty/plugins/PartialRender.js";
import ScssHandlerPlugin from "./src/_11ty/plugins/ScssHandler.js";


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
    eleventyConfig.addPlugin(EleventyWebcPlugin, {
        components: "./src/_includes/components/**/*.webc",
        bundlePluginOptions: { "transforms": [cssTransform] },
    });
    eleventyConfig.addPlugin(FaviconsPlugin, {});
    eleventyConfig.addPlugin(PartialRenderPlugin, {});
    eleventyConfig.addPlugin(ScssHandlerPlugin, {
        srcDirs: ["./src/_assets/css"],
        quiet: true,
    });
    eleventyConfig.addPlugin(CssTransformPlugin, {
        minify: true,
        targets: "> 0.2% and not dead",
    });
    eleventyConfig.addPlugin(HtmlPrettifierPlugin);

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
