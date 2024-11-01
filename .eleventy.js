import SassHandler from "./src/_11ty/handlers/SassHandler.js";
import include_section from "./src/_11ty/shortcodes/include_section.js";
import html_prettify from "./src/_11ty/transforms/html_prettify.js";

export default function (eleventyConfig) {
    eleventyConfig.ignores.add("**/_11ty/**");
    // scss handlers
    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", SassHandler);
    // shortCodes
    eleventyConfig.addNunjucksShortcode("include_section", include_section);

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
