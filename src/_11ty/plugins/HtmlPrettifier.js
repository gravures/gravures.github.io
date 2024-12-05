import prettify from "html-prettify";


export default function (eleventyConfig, options = {}) {
    async function _htmlMinifier(content) {
        if ((this.page.outputPath || "").endsWith(".html")) {
            return prettify(content, { char: " ", count: 4 });
        }
        // If not an HTML output, return content as-is
        return content;
    };
    eleventyConfig.addTransform("htmlprettify", _htmlMinifier);
};
