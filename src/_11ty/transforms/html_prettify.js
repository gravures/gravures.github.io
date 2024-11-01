import prettify from "html-prettify";

export default function (content) {
    return prettify(content, { char: " ", count: 4 });
};
