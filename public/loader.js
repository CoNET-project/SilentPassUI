"use strict";

const sw = self;

// 快取名稱：為 loader 和它所承載的 App 內容定義一個清晰的名稱
// 每次更新 REACT_APP_URLS 時，建議更改版本號以觸發 Service Worker 的更新
const CACHE_NAME = 'react-app-loader-cache-v6';

// isActivated 旗標不再需要，因為 loader 的職責很單純：要嘛從快取提供，要嘛讓網路請求通過。
// 它不需要一個「停用」狀態。

// ====================================================================================
// TODO: 這是你需要手動配置的最重要部分！
// 你需要將 React 應用 build 後在 `build/` 目錄下的所有關鍵檔案都列在這裡。
// 使用 `npm run build` 或 `yarn build` 後，去 `build/` 目錄下查看確切的檔名。
// ====================================================================================
const REACT_APP_URLS = [
  // 核心 HTML
  '/index.html',

  // React App 自己的 Service Worker
  '/service-worker.js',

  // 其他根目錄下的靜態資源
  '/manifest.json',
  '/favicon.ico',
  // 如果有其他 logo 或圖片，也需要加入
  // '/logo192.png',
  // '/logo512.png',

  // 主要的 JavaScript 檔案 (檔名中的 hash 會變化)
  '/static/js/main.xxxxxxxx.js',
  // '/static/js/787.xxxxxxxx.js', // Create React App 通常會有一個 vendors chunk

  // 主要的 CSS 檔案 (檔名中的 hash 會變化)
  '/static/css/main.yyyyyyyy.css'
];
// ====================================================================================


// install 事件：下載並快取所有 React App 的資源
sw.addEventListener('install', (event) => {
    console.log('[Loader SW] Install event: Caching the entire React application.');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[Loader SW] Caching: ${REACT_APP_URLS.join(', ')}`);
            return cache.addAll(REACT_APP_URLS);
        }).then(() => {
            // 強制新的 SW 立即取代舊的，並進入 activating 狀態
            return sw.skipWaiting();
        })
    );
});

// activate 事件：清理舊版本的快取
sw.addEventListener('activate', (event) => {
    console.log('[Loader SW] Activate event: Cleaning up old caches and taking control.');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 刪除所有不等於當前 CACHE_NAME 的快取
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Loader SW] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即控制所有客戶端（頁面）
            return sw.clients.claim();
        })
    );
});

// fetch 事件：從快取中提供 React App 的資源
sw.addEventListener('fetch', (event) => {
    const { request } = event;

    // 採用「快取優先」策略 (Cache-First)
    // 所有在 REACT_APP_URLS 列表中的請求都會被攔截並從快取返回。
    // 對於列表之外的請求（例如 API 請求），會直接走網路。
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // 如果快取中存在匹配的資源，直接返回它
            if (cachedResponse) {
                console.log(`[Loader SW] Serving from cache: ${request.url}`);
                return cachedResponse;
            }
            
            // 如果快取中沒有，則發起網路請求
            // 這對於 API calls 或其他未被快取的資源是必要的
            console.log(`[Loader SW] Not in cache, fetching from network: ${request.url}`);
            return fetch(request);
        })
    );
});