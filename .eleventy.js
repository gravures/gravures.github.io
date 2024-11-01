import SassHandler from "./src/_11ty/handlers/SassHandler.js";
import include_section from "./src/_11ty/shortcodes/include_section.js";
export default function (eleventyConfig) {
    eleventyConfig.ignores.add("**/_11ty/**");
    // scss handlers
    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", SassHandler);
    // shortCodes
    eleventyConfig.addNunjucksShortcode("include_section", include_section);
    return {
        dir: {
            input: "src",
            output: "_site",
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
    };
};
