/*
* This code is based on https://github.com/NJAldwin/eleventy-plugin-gen-favicons
*
* derived from:
* https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
*
* (2022 update)
* ico: 64/32/16
* apple png: 180x180 (140x140 + 20px bg padding preferred)
* manifest with:
* google home screen png: 192x192
* google loading png: 512x512
*/

import deepEq from "fast-deep-equal";
import fs from "graceful-fs";
import path from "path";
import toIco from "png-to-ico";
import sharp from "sharp";

const destSvg = '/favicon.svg';
const destIco = '/favicon.ico';
const destApple = '/apple-touch-icon.png';
const destGoogleHome = '/icon-192.png';
const destGoogleLoading = '/icon-512.png';
const destManifest = '/manifest.webmanifest';

const icoSizes = [64, 32, 16];
const appleSize = 180;
const googleHomeSize = 192;
const googleLoadSize = 512;

const cacheByFile = {};


async function _resizeIcon(fileName, fileMeta, newDim) {
    // expects square img
    const opts = fileMeta.density ? { density: (newDim / fileMeta.width) * fileMeta.density } : {};
    return sharp(fileName, opts).resize(newDim, newDim).png();
};


async function _iconToBuffers(fileName, fileMeta, dims = icoSizes) {
    async function _mapFn(dim) {
        return (await _resizeIcon(fileName, fileMeta, dim)).ensureAlpha().toBuffer();
    }

    return toIco(
        await Promise.all(dims.map(_mapFn))
    );
};


async function _appleBuffer(bgColor, padding, fileName, fileMeta) {
    return (
        await _resizeIcon(fileName, fileMeta, appleSize - (2 * padding))
    ).extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: bgColor,
    }).toBuffer();
};


async function writeBuffer(outputDir, fileName, buffer) {
    return fs.promises.writeFile(path.join(outputDir, fileName), buffer);
}

async function generateIcons(sourceFile, outputDir, options) {
    // console.log(`[FaviconPlugin] generateIcons: \n${inspect(options)}`);
    const {
        appleIconBgColor,
        appleIconPadding,
        generateManifest,
        manifestData,
        skipCache
    } = options;

    if (!fs.existsSync(sourceFile))
        throw new Error(`could not find sourceFile <${sourceFile}>.`);

    if (!fs.existsSync(outputDir))
        await fs.promises.mkdir(outputDir);

    const mtime = (await fs.promises.stat(sourceFile)).mtime;
    const [cachedMtime, cachedOpts] = cacheByFile[`${sourceFile}|${outputDir}`] || [0, {}];
    const srcMetadata = await sharp(sourceFile).metadata();
    const srcIsSvg = srcMetadata.format === 'svg';
    const { width, height } = srcMetadata;

    if (width !== height)
        throw new Error("source favicon must be square");

    if (appleIconPadding < 0 || ((2 * appleIconPadding) >= appleSize))
        throw new Error(
            `Apple icon padding must be >=0 and small enough to generate a ${appleSize}x${appleSize} image`
        );

    if (mtime > cachedMtime || (!deepEq(options, cachedOpts)) || skipCache) {
        if (srcIsSvg)
            await fs.promises.copyFile(sourceFile, path.join(outputDir, destSvg));

        await Promise.all([
            writeBuffer(
                outputDir, destIco,
                await _iconToBuffers(sourceFile, srcMetadata)
            ),
            writeBuffer(
                outputDir, destApple,
                await _appleBuffer(appleIconBgColor, appleIconPadding, sourceFile, srcMetadata)
            ),
            writeBuffer(
                outputDir, destGoogleHome,
                await (await _resizeIcon(sourceFile, srcMetadata, googleHomeSize)).toBuffer()
            ),
            writeBuffer(
                outputDir, destGoogleLoading,
                await ((await _resizeIcon(sourceFile, srcMetadata, googleLoadSize)).toBuffer())
            ),
        ]);

        if (generateManifest) {
            const manifest = Object.assign({}, manifestData, {
                'icons': [
                    { 'src': destGoogleHome, 'type': 'image/png', 'sizes': `${googleHomeSize}x${googleHomeSize}` },
                    { 'src': destGoogleLoading, 'type': 'image/png', 'sizes': `${googleLoadSize}x${googleLoadSize}` },
                ],
            });
            await fs.promises.writeFile(
                path.join(outputDir, destManifest), JSON.stringify(manifest), 'utf-8'
            );
        }

        cacheByFile[`${sourceFile}|${outputDir}`] = [mtime, options];
    }

    return Object.assign(
        generateManifest ? { 'manifest': destManifest } : {},
        srcIsSvg ? { 'svg': destSvg } : {},
        {
            'ico': destIco,
            'apple': destApple,
            'googleHome': destGoogleHome,
            'googleLoading': destGoogleLoading,
        },
    );
};

async function generateHtml(iconFiles) {
    return (
        `<link rel="icon" href="${iconFiles['ico']}" sizes="any">
        ${'svg' in iconFiles ? `<link rel="icon" href="${iconFiles['svg']}" type="image/svg+xml">
        ` : ''}<link rel="apple-touch-icon" href="${iconFiles['apple']}">
        ${'manifest' in iconFiles ? `<link rel="manifest" href="${iconFiles['manifest']}">
        ` : ''}`
    );
};


export default function (eleventyConfig, options = {}) {
    const defaultOptions = {
        sourceFile: undefined,
        outputDir: "",
        appleIconBgColor: "white",
        appleIconPadding: 20,
        generateManifest: true,
        manifestData: {},
        skipCache: false,
    };
    let _options = Object.assign(defaultOptions, options);

    if ((_options.sourceFile === undefined) ||
        path.isAbsolute(_options.sourceFile) ||
        (_options.sourceFile.includes(".."))) {
        throw new Error(`sourceFile should be a path relative to your eleventy input directory, got <${_options.inputDir}>`);
    }

    if (path.isAbsolute(_options.outputDir) || _options.outputDir.includes(".."))
        throw new Error(`outputDir should be a path relative to the eleventy output directory, got <${_options.outputDir}>`);

    let generatedFiles;
    eleventyConfig.on("eleventy.before", async ({ directories }) => {
        let outputDir = path.join(directories.output, _options.outputDir);
        let sourceFile = path.join(directories.input, _options.sourceFile);
        generatedFiles = await generateIcons(sourceFile, outputDir, _options);
    });

    async function _faviconShortCode() {
        return await generateHtml(generatedFiles);
    };

    eleventyConfig.addAsyncShortcode("favicons", _faviconShortCode);
};