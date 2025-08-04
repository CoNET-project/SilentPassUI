const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const path = require('path');

module.exports = {
    webpack: {
        alias: {
            '@': path.resolve(__dirname, 'src'), // 让 @ 指向 src 目录
        }
    }
};