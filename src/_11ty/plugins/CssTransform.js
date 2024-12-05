import { parse } from "path";

import browserslist from "browserslist";
import { browserslistToTargets, transform } from "lightningcss";

const defaultOptions = {
    minify: false,
    targets: "> 0.25%",
};

async function processCss(content, minify) {
    let { code, map } = transform({
        code: Buffer.from(content),
        minify: minify,
        sourceMap: false,
        targets: defaultOptions.targets,
    });
    return code;
}

async function cssTransform(content) {
    if (!content)
        return;

    let { type, page, env } = this;
    let parsed = parse(page.outputPath || "");

    // this will handle css rendered by custom template (eg: scssHandler)
    // as well as those produced by the bundlePlugin.
    if ((parsed.ext === ".css" && !parsed.name.startsWith("_")) || type === "css") {
        return await processCss(content, defaultOptions.minify);
    }
    return content;
}

export default function (eleventyConfig, options = {}) {
    /**
     * @typedef {object} options
     * @property {boolean} [minify] - Whether minifing css on build.
     * @property {string} [targets] - Browsers list (see: https://browsersl.ist).
     */
    Object.assign(defaultOptions, options);

    eleventyConfig.on("eleventy.before", async ({ runMode }) => {
        defaultOptions.minify = (runMode === "build") && defaultOptions.minify;
        defaultOptions.targets = browserslistToTargets(browserslist(defaultOptions.targets));
    });

    eleventyConfig.addTransform("CssTransform", cssTransform);
};

// export the transform for easy inclusion in bundle's transforms option
export { cssTransform };
