const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

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

module.exports = {
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
            if (process.env.NODE_ENV === 'production') {
                webpackConfig.optimization.minimizer = [
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                // Gossip listen logs must use gossipLog() (bracket+apply).
                                // Direct console.* CallExpressions are stripped here.
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