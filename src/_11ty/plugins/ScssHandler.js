import path from "path";
import * as sass from "sass";

export default function (eleventyConfig, options = {}) {
    /**
     * @typedef {object} options
     * @property {Array} [srcDirs] - Array of directories for sass to look for module.
     * @property {boolean} [sourceMap] - Whether to output sass source Map.
     * @property {boolean} [quiet] - Whether to let sass emit warnings.
     */
    let defaultOptions = {
        srcDirs: [],
        sourceMap: false,
        quiet: false,
    };
    let opts = Object.assign(defaultOptions, options);

    eleventyConfig.addTemplateFormats("scss");
    eleventyConfig.addExtension("scss", {
        outputFileExtension: "css",
        useLayouts: false,
        compile: async function (inputContent, inputPath) {
            let parsed = path.parse(inputPath);
            if (parsed.name.startsWith("_")) {
                // add support for Sass’ underscore convention
                // (file names that start with an underscore aren’t
                // written to the output directory), just return early.
                return;
            }

            let loadPaths = [...[parsed.dir || ".", this.config.dir.includes], ...opts.srcDirs];
            loadPaths = [...new Set(loadPaths)];

            // using compileString from the Sass library
            // for speed benefits over their asynchronous counterparts
            let result = sass.compileString(inputContent, {
                // provide a set of directories to look for
                // when using Sass’ @use, @forward, and @import features
                loadPaths: loadPaths,
                sourceMap: opts.sourceMap,
                quietDeps: opts.quiet,
            });

            // if a template syntax allows use of other templates
            // (think @use in Sass or webc:import in WebC), Eleventy
            // needs to know about the dependencies a template file relies on.
            this.addDependencies(inputPath, result.loadedUrls);

            return async () => {
                return result.css;
            };
        },
        compileOptions: {
            permalink: function (contents, inputPath) {
                let parsed = path.parse(inputPath);
                return async () => {
                    return path.join("css", parsed.name) + ".css";
                };
            }
        },
    }
    );

    // Prevent css output files to end up in collections.all
    eleventyConfig.addGlobalData(
        "eleventyComputed", {
        eleventyExcludeFromCollections:
            async (data) => {
                return data.page.templateSyntax === "scss";
            }
    });
};
