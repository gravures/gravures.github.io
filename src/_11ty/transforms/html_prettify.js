import prettify from "html-prettify";

export default function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
        return prettify(content, { char: " ", count: 4 });
    }
    // If not an HTML output, return content as-is
    return content;
};
