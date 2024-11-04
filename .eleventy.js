import faviconsPlugin from "eleventy-plugin-gen-favicons";
import SassHandler from "./src/_11ty/handlers/SassHandler.js";
import include_partial from "./src/_11ty/shortcodes/include_partial.js";
import html_prettify from "./src/_11ty/transforms/html_prettify.js";

export default function (eleventyConfig) {
    // ignore directories
    eleventyConfig.ignores.add("**/_11ty/**");

    // globals
    eleventyConfig.addGlobalData("layouts.root", "layouts");
    eleventyConfig.addGlobalData("layouts.partials", "partial");

    // plugins
    eleventyConfig.addPlugin(faviconsPlugin, {});

    // scss handlers
    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", SassHandler);

    // shortCodes
    eleventyConfig.addPlugin(include_partial, {});

    // transforms
    eleventyConfig.addTransform("htmlprettify", html_prettify);

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
