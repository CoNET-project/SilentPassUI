const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

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