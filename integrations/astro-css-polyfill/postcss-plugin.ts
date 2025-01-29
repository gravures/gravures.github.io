import caniuse from "caniuse-api"

import type { AstroIntegrationLogger, InjectedScriptStage } from "astro"
import type { PluginCreator } from "postcss"


type Polyfill = {
    name: string,
    code: string,
    enabled: boolean,
    done: boolean
}


const polyfills: { [index: string]: Polyfill } = {
    cssBlank: {
        // https://github.com/csstools/postcss-plugins/tree/main/plugins/css-blank-pseudo
        name: "blank-pseudo",
        code: "import cssBlankPseudoInit from 'css-blank-pseudo/browser';cssBlankPseudoInit();",
        enabled: true,
        done: false
    },
    cssFocusVisible: {
        // https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-focus-visible
        name: "css-focus-visible",
        code: "import 'focus-visible';",
        enabled: true,
        done: false
    },
    cssFocusWithin: {
        // https://github.com/csstools/postcss-plugins/tree/main/plugins/postcss-focus-within
        name: "css-focus-within",
        code: "import focusWithinInit from 'postcss-focus-within/browser';focusWithinInit();",
        enabled: true,
        done: false
    },
    cssHas: {
        // https://github.com/csstools/postcss-plugins/tree/main/plugins/css-has-pseudo
        name: "css-has",
        code: "import cssHasPseudo from 'css-has-pseudo/browser';cssHasPseudo(document);",
        enabled: true,
        done: false
    },
    cssPrefersColorScheme: {
        // https://github.com/csstools/postcss-plugins/tree/main/plugins/css-prefers-color-scheme
        name: "prefers-color-scheme",
        code: "import prefersColorSchemeInit from 'css-prefers-color-scheme/browser';prefersColorSchemeInit();",
        enabled: true,
        done: false
    },
    cssContainerQueries: {
        // https://github.com/GoogleChromeLabs/container-query-polyfill
        name: "css-container-queries",
        code: "import 'container-query-polyfill;'",
        enabled: false,
        done: false
    }
}

const detectedPolyfills: Set<Polyfill> = new Set()


type polyfillDetectOptions = {
    preserve?: boolean,
    logger?: AstroIntegrationLogger,
    env?: string
    browserslist: Array<string>
}

const polyfillDetect: PluginCreator<polyfillDetectOptions> = ({ browserslist, logger }: polyfillDetectOptions = { browserslist: [] }) => {

    const isCqSupported = caniuse.isSupported("css-container-queries", browserslist)

    return {
        postcssPlugin: "astro-css-polyfill-detect",
        AtRule(atRule) {
            if (!isCqSupported && atRule.name === "container")
                detectedPolyfills.add(polyfills.cssContainerQueries)

            atRule.walkDecls(decl => {
                if (decl.prop === "color" && (decl.value === "48842621" || decl.value === "70318723"))
                    detectedPolyfills.add(polyfills.cssPrefersColorScheme)
            })
        },
        Rule(rule): void {
            if (rule.selector.includes(".js-has-pseudo"))
                detectedPolyfills.add(polyfills.cssHas)
            if (rule.selector.includes(".js-blank-pseudo"))
                detectedPolyfills.add(polyfills.cssBlank)
            if (rule.selector.includes(".js-focus-visible"))
                detectedPolyfills.add(polyfills.cssFocusVisible)
            if (rule.selector.includes(".js-focus-within"))
                detectedPolyfills.add(polyfills.cssFocusWithin)
        }
    }
}
polyfillDetect.postcss = true


export type polyfillInjectOptions = {
    preserve?: boolean,
    logger?: AstroIntegrationLogger
    injectScript?: (stage: InjectedScriptStage, content: string) => void
}

const polyfillInject: PluginCreator<polyfillInjectOptions> = ({ injectScript, logger }: polyfillInjectOptions = {}) => {

    return {
        postcssPlugin: "astro-css-polyfill-inject",
        Once(root): void {
            for (const poly of detectedPolyfills) {
                if (injectScript && !poly.done) {
                    if (poly.enabled) {
                        injectScript("page", poly.code)
                        logger?.info(`<${poly.name}> polyfill will be injected in all pages`)
                    } else
                        logger?.warn(`<${poly.name}> should be polyfilled considering your browsers support (but is not enabled).`)
                    poly.done = true
                }
            }
        }
    }
}
polyfillInject.postcss = true


export { polyfillDetect, polyfillInject }
