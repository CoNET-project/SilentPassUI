const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // 只在生產環境建置時才啟用 Service Worker
      if (env === 'production') {
        // 找到 CRA 原本的 Workbox 設定並修改或替換它
        // 確保我們使用 InjectManifest 來控制自己的 SW 檔案
        const workboxPlugin = webpackConfig.plugins.find(
          (plugin) => plugin.constructor.name === 'GenerateSW'
        );

        if (workboxPlugin) {
          // 替換 CRA 預設的 GenerateSW 為 InjectManifest
          webpackConfig.plugins.splice(webpackConfig.plugins.indexOf(workboxPlugin), 1);
        }
        
        webpackConfig.plugins.push(
          new WorkboxWebpackPlugin.InjectManifest({
            // swSrc 是您自訂的 Service Worker 原始檔案
            swSrc: path.resolve(__dirname, 'public/service-worker1.js'),
            // swDest 是輸出到 build 資料夾的檔案名稱
            swDest: 'service-worker1.js',
            // 不要預快取 source maps
            exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          })
        );
      }
      return webpackConfig;
    },
  },
};