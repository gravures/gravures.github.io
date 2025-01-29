# Astro Css Polyfill

An astro integration that's add javascript polyfills to your pages for css features not supported by your browserslist.

## Why

First I found it cool to have a tool to auto magically injecting javascript polyfill as needed. Secondly *postcss-preset-env* is a great tool but its logs never noticed me if it actually polyfilled anything that needed its javascript counter part. Lastly  *postcss-preset-env* is not handling some polyfills i want to use.

## How it works

This integration includes a postcss plugin that looks for selectors or special poperties added by the *postcss-preset-env* plugin.  It also check for some additional polyfills if such feature is unsuppoted in regard of the browserslist settings. This way a set of javascript polyfills to be included is produced.

In a second step each requested polyfill is injected using the astro integration api. Script will be resolved and optimized by vite and imported as an esm module in the page's Head.

> **Important!**: One caveat of the current design is that all polyfills will be bundled in all pages. At no stage this integration could determin if such polyfill is only needed by the *component A* or by the *About page*.

 

## Usage

```bash
npm install gravures/gravures.github.io/integrations/astro-css-polyfill
```

.browserslistrc

```ini
[production]
> 0.5%
last 2 versions
Firefox ESR
not dead

[test]
last 2 chrome version
last 2 firefox version
```

astro.config.mjs

```js
import { defineConfig } from "astro/config";
import astroCssPolyfill from "astro-css-polyfill";
import postcssPresetEnv from "postcss-preset-env";

const browsers = "production";

export default defineConfig({
    integrations: [
        astroCssPolyfill({ env: browsers }),
    ],
    vite: {
        css: {
            postcss: {
                plugins: [
                    postcssPresetEnv({
                        stage: 0,
                        env: browsers,
                        enableClientSidePolyfills: true,
                        preserve: true,
                    }),
                ]
            }
        }
    }
});
```

## Supported polyfills

polyfills needed by [postcss--preset-env](https://github.com/csstools/postcss-plugins/tree/main/plugin-packs/postcss-preset-env#readme):

* [css-blank-pseudo](https://github.com/csstools/postcss-plugins/tree/main/plugins/css-blank-pseudo)

* [css-focus-visible](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-focus-visible)

* [css-focus-within](https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-focus-within)

* [css-has-pseudo](https://github.com/csstools/postcss-plugins/tree/main/plugins/css-has-pseudo)

* [css-prefers-color-scheme](https://github.com/csstools/postcss-plugins/tree/main/plugins/css-prefers-color-scheme)

Additional polyfills:

* [css-containers-queries](https://github.com/GoogleChromeLabs/container-query-polyfill)
