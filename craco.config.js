const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = {
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