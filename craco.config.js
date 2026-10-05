const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

function ForceAsyncSplitPlugin() {}
ForceAsyncSplitPlugin.prototype.apply = function (compiler) {
    compiler.hooks.environment.tap('ForceAsyncSplitPlugin', () => {
        // No shared async chunks. The chat worker's importScripts of those
        // chunks never finishes, so the relay cannot open.
        compiler.options.optimization = compiler.options.optimization || {}
        if (process.env.NODE_ENV !== 'production') {
            compiler.options.optimization.splitChunks = false
            process.stderr.write('[Build] dev splitChunks disabled so the chat worker is one script\n')
        }
    })
}

function WholeChatWorkerPlugin() {}
WholeChatWorkerPlugin.prototype.apply = function (compiler) {
    compiler.hooks.compilation.tap('WholeChatWorkerPlugin', (compilation) => {
        compilation.hooks.childCompiler.tap('WholeChatWorkerPlugin', (childCompiler, compilerName) => {
            if (!/worker/i.test(String(compilerName))) return
            const optimization = childCompiler.options.optimization || {}
            childCompiler.options.optimization = {
                ...optimization,
                splitChunks: false,
                runtimeChunk: false,
            }
            process.stderr.write('[Build] inline chat worker chunks (' + compilerName + ')\n')
        })
    })
}

function BuildProgressPlugin() {
    this.startTime = null;
}
BuildProgressPlugin.prototype.apply = function (compiler) {
    const self = this;
    compiler.hooks.environment.tap('BuildProgressPlugin', () => {
        process.stderr.write('[Build] Webpack compiler created\n');
    });
    compiler.hooks.compile.tap('BuildProgressPlugin', () => {
        self.startTime = Date.now();
        process.stderr.write('[Build] 0% - Compiling...\n');
    });
    compiler.hooks.compilation.tap('BuildProgressPlugin', () => {
        process.stderr.write('[Build] 20% - Building modules...\n');
    });
    compiler.hooks.emit.tap('BuildProgressPlugin', () => {
        const elapsed = ((Date.now() - self.startTime) / 1000).toFixed(1);
        process.stderr.write(`[Build] 80% - Emitting assets... (${elapsed}s)\n`);
    });
    compiler.hooks.done.tap('BuildProgressPlugin', () => {
        const elapsed = ((Date.now() - self.startTime) / 1000).toFixed(1);
        process.stderr.write(`[Build] 100% - Done in ${elapsed}s\n`);
    });
};

function shouldShowRuntimeOverlayError(error) {
    const message = error && error.message ? String(error.message) : '';
    // Chromium ResizeObserver loop is benign; the overlay otherwise covers Discover.
    return !/ResizeObserver loop/i.test(message);
}

module.exports = {
    devServer: (devServerConfig) => {
        const client = devServerConfig.client || {};
        const overlay =
            typeof client.overlay === 'object' && client.overlay
                ? { ...client.overlay }
                : { errors: true, warnings: false };
        overlay.runtimeErrors = shouldShowRuntimeOverlayError;
        devServerConfig.client = { ...client, overlay };
        return devServerConfig;
    },
    style: {
        css: {
            loaderOptions: (options) => {
                options.url = options.url ?? {};
                if (typeof options.url === 'object' && !options.url.filter) {
                    options.url.filter = (url) => !/^https?:\/\//i.test(url);
                }
                return options;
            }
        }
    },
    webpack: {
        alias: {
            '@': path.resolve(__dirname, 'src'), // 让 @ 指向 src 目录
        },
        configure: (webpackConfig) => {
            webpackConfig.cache = { type: 'filesystem' };
            webpackConfig.plugins = webpackConfig.plugins || [];
            webpackConfig.plugins.push(new BuildProgressPlugin());
            webpackConfig.plugins.push(new WholeChatWorkerPlugin());
            webpackConfig.plugins.push(new ForceAsyncSplitPlugin());
            webpackConfig.plugins.forEach((plugin) => {
                const name = plugin && plugin.constructor && plugin.constructor.name
                if (name !== 'ReactRefreshPlugin') return
                plugin.options = plugin.options || {}
                const prev = plugin.options.exclude
                const extra = [/conet-chat-sdk[\\/]dist[\\/]worker/]
                plugin.options.exclude = Array.isArray(prev) ? prev.concat(extra) : prev ? [prev].concat(extra) : extra
            })

            // CRA puts source-map-loader on a top-level rule, not inside oneOf.
            // Missing maps under hoisted node_modules (bs58 → base-x) fail the compile.
            const excludeNodeSourceMaps = (rule) => {
                if (!rule || typeof rule !== 'object') return;
                if (rule.loader && String(rule.loader).includes('source-map-loader')) {
                    rule.exclude = /node_modules/;
                }
                for (const key of ['oneOf', 'rules', 'use']) {
                    if (Array.isArray(rule[key])) rule[key].forEach(excludeNodeSourceMaps);
                }
            };
            webpackConfig.module.rules.forEach(excludeNodeSourceMaps);
            webpackConfig.ignoreWarnings = [
                ...(webpackConfig.ignoreWarnings || []),
                /Failed to parse source map/,
            ];
            // The chat worker must be one classic script. Split vendor chunks
            // are loaded with importScripts and never finish, so voice listen
            // has no worker and the call reports that the relay could not open.
            webpackConfig.optimization = webpackConfig.optimization || {}
            // Keep OpenPGP inside the chat worker script. Shared async vendor
            // chunks do not finish loading in that worker, so voice listen
            // never starts and the call says the relay could not open.
            // A classic Worker cannot rely on CRA's async vendor chunks:
            // importScripts() in the emitted worker never completes there.
            // Keep the worker and its OpenPGP/ethers dependencies in one
            // executable script in development and production.
            webpackConfig.optimization.splitChunks = false
            webpackConfig.optimization.runtimeChunk = false
            if (process.env.NODE_ENV === 'production') {
                webpackConfig.optimization.minimizer = [
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                drop_console: true, // 去除 console
                                drop_debugger: true // 去除 debugger
                            }
                        }
                    })
                ];
            }
            return webpackConfig;
        }
    }
};