import path from "path";
import sass from "sass";

export default {
    outputFileExtension: "css",
    compile: async function (inputContent, inputPath) {
        let parsed = path.parse(inputPath);
        if (parsed.name.startsWith("_")) {
            // add support for Sass’ underscore convention
            // (file names that start with an underscore aren’t
            // written to the output directory), just return early.
            return;
        }

        // using compileString from the Sass library
        // for speed benefits over their asynchronous counterparts
        let result = sass.compileString(inputContent, {
            // provide a set of directories to look for
            // when using Sass’ @use, @forward, and @import features
            loadPaths: [
                parsed.dir || ".",
                this.config.dir.includes
            ]
        });

        // if a template syntax allows use of other templates
        // (think @use in Sass or webc:import in WebC), Eleventy
        // needs to know about the dependencies a template file relies on.
        this.addDependencies(inputPath, result.loadedUrls);

        return async (data) => {
            return result.css;
        };
    }
};
