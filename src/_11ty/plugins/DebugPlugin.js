import { inspect } from "util";

export default function (eleventyConfig, options = {}) {
    eleventyConfig.on("eleventy.after", async ({ directories, results, runMode, outputMode }) => {
        console.log(`\n[DebugPlugin] ${runMode}:`);
        console.log(inspect(this));
    });

    async function debug(content) {
        let data = Object.assign({}, this);
        function log(data) {
            console.log(`\n[DebugPlugin] ${data.inputPath}:`);
            console.log(inspect(data));
        };
        let _dbg = eleventyConfig.augmentFunctionContext(log, { source: data });
        _dbg(data);
    };

    // eleventyConfig.addGlobalData(
    //     "eleventyComputed", {
    //     eleventyExcludeFromCollections:
    //         async (data) => {
    //             // console.log(inspect(data.page));
    //             return data.page.templateSyntax === "scss";
    //         }
    // });

    eleventyConfig.addLinter("debug", debug);
}