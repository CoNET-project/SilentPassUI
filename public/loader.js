"use strict";
const sw = self;

// 快取名稱仍然有用，但主要是為了快取 loader.html 本身或之後的動態內容
const CACHE_NAME = 'SilentPassVPN-loader-cache-v4';
let isActivated = false;
// 預快取的內容大幅減少，甚至可以只快取 loader.html
// 這裡我們假設 loader.html 就是根目錄 '/'
const LOADER_URLS = ['/loader.html','loader.js']; // 或 '/'

// install 事件：只快取加載器本身
sw.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching loader shell');
            return cache.addAll(LOADER_URLS);
        }).then(() => sw.skipWaiting()) // 強制新的 SW 立即取代舊的
    );
});

// activate 事件：清理舊快取並立即控制頁面
sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            isActivated = true;
            sw.clients.claim();
        }) // 立即控制所有客戶端
    );
});

// --- 核心邏輯 ---

// 判斷請求是否為 React App 的一部分
const isReactAppResource = (req) => {
    const url = new URL(req.url);
    // 攔截對 index.html 的請求以及所有 /static/ 路徑下的 JS 和 CSS
    return url.pathname === '/index.html' || 
           url.pathname.startsWith('/static/') ||
           url.pathname === '/manifest.json' ||
           url.pathname === '/service-worker.js' ||
           url.pathname === '/favicon.ico';
           
};

const forwardToNode = (req) => {
    const urlObj = new URL(req.url);
    const _targetUrl = `http://localhost:3001${urlObj.pathname}`;
    // ... 複製 headers 和 body ...
    const newRequest = new Request(_targetUrl, {method: req.method, headers: req.headers, body: req.body, redirect: 'manual'});
    console.log(`[SW] Forwarding ${req.url} to a node.`);
    return fetch(newRequest);
};


// fetch 事件：攔截並轉發 React App 請求
sw.addEventListener('fetch', (event) => {
    if (isActivated) {
        // 如果 Service Worker 已經啟動，則不執行任何攔截操作。
        // 透過不呼叫 event.respondWith()，請求會直接傳送到網路，
        // 如同沒有 Service Worker 一樣。
        console.log('[Bootloader SW] Deactivated. Passing request to network:', event.request.url);
        return;
    }

    const { request } = event;
    
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                console.log(`[SW] Serving from cache: ${request.url}`);
                return cachedResponse;
            }
            if (isReactAppResource(request)) {
                return forwardToNode(request);
            }
            return fetch(request);
        })
    );
    
});