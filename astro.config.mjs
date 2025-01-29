// @ts-check
import mdx from "@astrojs/mdx";
import favicons from "astro-favicons";
import { defineConfig } from "astro/config";
// import cssNano from "cssnano";
import astroCssPolyfill from "astro-css-polyfill";
import postcssPresetEnv from "postcss-preset-env";


const browsers = "production";

export default defineConfig({
    site: "https://www.ideographe.fr",
    output: 'static',
    i18n: {
        locales: ["en", "fr"],
        defaultLocale: "fr",
        // SSR only:
        // fallback: { en: "fr" },
        // routing: { fallbackType: "rewrite" }
    },
    integrations: [
        mdx(),
        favicons(),
        astroCssPolyfill({ env: browsers }),
    ],
    compressHTML: false,
    build: {
        inlineStylesheets: `auto`,
    },
    vite: {
        build: {
            cssMinify: false,
        },
        css: {
            preprocessorOptions: {
                scss: {
                    // https://sass-lang.com/documentation/js-api/interfaces/stringoptions/
                    api: "modern-compiler",
                    quietDeps: true,
                    additionalData: "", // '@use "src/styles/variables.scss" as *;'
                }
            },
            postcss: {
                plugins: [
                    // https://github.com/csstools/postcss-plugins/tree/main/plugin-packs/postcss-preset-env
                    // https://github.com/browserslist/browserslist
                    postcssPresetEnv({
                        stage: 0,
                        env: browsers,
                        autoprefixer: {},
                        enableClientSidePolyfills: true,
                        preserve: true,
                        debug: false,
                    }),
                    // https://cssnano.github.io/cssnano/docs/config-file/
                    // cssNano({
                    //     preset: ["default", {
                    //         convertValue: false,
                    //     }]
                    // }),
                ]
            }
        }
    },
    experimental: {
        contentIntellisense: true,
    }
});
