import { existsSync } from "fs";
import path from "path";

export default function (template, type) {
    type = type + ".njk"
    let tmp = path.join(this.eleventy.directories.includes, template, type);
    tmp = path.resolve(tmp);
    if (!existsSync(tmp))
        type = "default.njk";
    return this.env.render(path.join(template, "default.njk"), this.ctx);
};
