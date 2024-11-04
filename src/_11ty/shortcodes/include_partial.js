import { existsSync } from "fs";
import path from "path";


const config = {
    partials: "partials",
    default: "default",
};


function include_partial(template, type) {
    type = type + config.ext
    let tmp = path.join(this.eleventy.directories.includes, config.partials, template, type);
    tmp = path.resolve(tmp);
    if (!existsSync(tmp))
        type = config.default + config.ext;
    return this.env.render(path.join(config.partials, template, type), this.ctx);
};


export default function (eleventyConfig, options) {
    Object.assign(config, options, { ext: ".njk" });
    eleventyConfig.addNunjucksShortcode("include_partial", include_partial);
};
