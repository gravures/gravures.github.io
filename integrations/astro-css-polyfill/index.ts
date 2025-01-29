import type { AstroIntegration, AstroIntegrationLogger, HookParameters, InjectedScriptStage } from "astro"
import browsersList from "browserslist"
import { polyfillDetect, polyfillInject } from "./postcss-plugin"


function addPostcssPlugins(
    logger: AstroIntegrationLogger,
    injectScript: (stage: InjectedScriptStage, content: string) => void,
    browserslist: string[]
): object {
    return {
        vite: {
            css: {
                postcss: {
                    plugins: [
                        polyfillDetect({ logger, browserslist }),
                        polyfillInject({ logger, injectScript })
                    ],
                }
            }
        }
    }
}


type Options = {
    browsers?: string | Array<string> | null
    env?: string
}

/**
 * Astro Integration entry point
 */
export default function cssPolyfill(options: Options = {}): AstroIntegration {
    const env = options.browsers ? undefined : options.env
    const browsers = options.browsers
    const supportedBrowsers: string[] = browsersList(
        browsers, { env: env, ignoreUnknownVersions: true }
    )

    return {
        name: "css-polyfill-integration",
        hooks: {
            "astro:config:setup": ({ command, logger, injectScript, updateConfig }: HookParameters<"astro:config:setup">) => {
                if (command === "dev" || command === "build") {
                    logger.info("CSS Polyfill integration is running...")
                    updateConfig(addPostcssPlugins(logger, injectScript, supportedBrowsers))
                }
            }
        }
    }
}
