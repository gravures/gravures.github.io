import { parse } from "path";

import browserslist from "browserslist";
import { browserslistToTargets, transform } from "lightningcss";

const defaultOptions = {
    minify: false,
    browsersList: "> 0.25%",
};

const _options = {};

async function processCss(content, minify, targets) {
    let { code, map } = transform({
        code: Buffer.from(content),
        minify: minify,
        sourceMap: false,
        targets: targets,
    });
    return code;
}

async function cssTransform(content) {
    if (!content)
        return;

    let { type, page } = this;
    let parsed = parse(page.outputPath || "");

    // this will handle css rendered by custom template (eg: scssHandler)
    // as well as those produced by the bundlePlugin.
    if ((parsed.ext === ".css" && !parsed.name.startsWith("_")) || type === "css") {
        return await processCss(content, _options.shouldMinify, _options.targets);
    }
    return content;
}

export default function (eleventyConfig, options = {}) {
    /**
     * @typedef {object} options
     * @property {boolean} [minify] - Whether minifing css on build.
     * @property {string}  [browsersList] - Browsers list (see: https://browsersl.ist).
     */
    Object.assign(_options, defaultOptions, options);

    eleventyConfig.on("eleventy.before", async ({ runMode }) => {
        _options.shouldMinify = (runMode === "build") && _options.minify;
        _options.targets = browserslistToTargets(browserslist(_options.browsersList));
    });

    eleventyConfig.addTransform("CssTransform", cssTransform);
};

// export the transform for easy inclusion in bundle's transforms option
export { cssTransform };
