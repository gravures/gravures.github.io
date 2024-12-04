import fs from "graceful-fs";
import path from "path";

import { RenderPlugin as Render } from "@11ty/eleventy";
import { isPlainObject } from "@11ty/eleventy-utils";


/** @this {object} */
async function renderShortcodeFn(fn, data) {
    if (fn === undefined) {
        return;
    } else if (typeof fn !== "function") {
        throw new Error(`The \`compile\` function did not return a function. Received ${fn}`);
    }

    // if the user passes a string or other literal, remap to an object.
    if (!isPlainObject(data)) {
        data = {
            _: data,
        };
    }

    if ("data" in this && isPlainObject(this.data)) {
        // when options.accessGlobalData is true, this allows the global data
        // to be accessed inside of the shortcode as a fallback
        data = Render.ProxyWrap(data, this.data);
    } else {
        // save `page` and `eleventy` for reuse
        data.page = this.page;
        data.eleventy = this.eleventy;
    }
    return fn(data);
}


export default function (eleventyConfig, options = {}) {
    /**
     * @typedef {object} options
     * @property {string} [partials] - The directory containing partials relative to _includes.
     * @property {string} [default] - Name of the default partial's template.
     * @property {boolean} [true] - Whenever emit console warning about missing partial's template.
     */
    let defaultOptions = {
        partials: "partials",
        default: "default",
        warn: true,
        templateConfig: null,
    };
    let opts = Object.assign(defaultOptions, options);

    let templateConfig;
    eleventyConfig.on("eleventy.config", (cfg) => {
        templateConfig = cfg;
    });

    let extensionMap;
    eleventyConfig.on("eleventy.extensionmap", (map) => {
        extensionMap = map;
    });

    /** @this {object} */
    async function _includePartialFn(template, type, data = {}) {
        let options = {
            templateConfig: opts.templateConfig || templateConfig,
            extensionMap,
        };

        // Let find which template to render
        let partials = path.join(this.eleventy.directories.includes, opts.partials, template);
        let found = null;
        if (fs.existsSync(partials)) {
            for (let item of fs.readdirSync(partials)) {
                item = path.parse(item);
                if (item.name === opts.default) {
                    found = item.base;
                    continue;
                } else if (item.name === type) {
                    found = item.base;
                    break;
                }
            }
        }
        // console.log(inspect(this.ctx));
        if (!found) {
            if (opts.warn)
                console.warn(`No partial defined for <${template}>`);
            return "";
        }

        // do the thing...
        let templateLang = null;
        let inputPath = path.join(partials, found);
        let fn = await Render.File.call(this, inputPath, options, templateLang);
        return renderShortcodeFn.call(this, fn, data);
    }

    eleventyConfig.addAsyncShortcode("partial", _includePartialFn);
};
