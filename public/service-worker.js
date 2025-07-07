"use strict";
const sw = self;
// 定義緩存的名稱和版本。更新 Service Worker 時，應該更改此版本號。
const CACHE_NAME = 'my-app-cache-v10';
// 需要特殊處理的 manifest.json 的 URL
const MANIFEST_URL = '/asset-manifest.json';
// App Shell：應用核心靜態資源，在安裝時預先快取
const APP_SHELL_URLS = [
    "https://ios-test.silentpass.io/",
    "https://ios-test.silentpass.io/",
    "https://vpn4.silentpass.io/",
    "https://vpn-beta.conet.network/",
    "https://vpn9.conet.network/",
    "/static/css/main.88cc8d9a.css",
    "/static/js/main.5980966c.js",
    "/favicon.ico",
    "/assets/info.svg",
    "/assets/silent-pass-logo-grey.png",
    "/static/css/main.88cc8d9a.css.map",
    "/static/js/453.a5cbc0be.chunk.js.map",
    "/static/js/main.5980966c.js.map",
    "/manifest.json",
    "https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/us.svg"
];
/**
 * 安裝事件 (install)
 * 使用 sw 取代 self，並為 event 參數提供正確的類型。
 */
sw.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Pre-caching App Shell');
        return cache.addAll(APP_SHELL_URLS);
    }));
});
/**
 * 啟用事件 (activate)
 * 清理舊版本的緩存。
 */
sw.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
                console.log(`[Service Worker] Clearing old cache: ${cacheName}`);
                return caches.delete(cacheName);
            }
        }));
    }).then(() => sw.clients.claim()) // 使用 sw.clients.claim()
    );
});
/**
 * 攔截請求事件 (fetch)
 */
const checkAPP_SHELL_URLS = (req) => {
    const index = APP_SHELL_URLS.findIndex(n => req.url.endsWith(n));
    return index > -1;
};
sw.addEventListener('fetch', (event) => {
    const { request } = event;
    event.respondWith(caches.match(request).then((cachedResponse) => {
        // 如果緩存中有匹配的資源，直接返回
        if (cachedResponse) {
            return cachedResponse;
        }
        // 否則，從網路請求
        return fetch(request).then((networkResponse) => {
            // 檢查是否是有效的回應
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' || !checkAPP_SHELL_URLS(request)) {
                return networkResponse;
            }
            // 複製一份回應，因為 request 和 cache 都需要使用它
            const responseToCache = networkResponse.clone();
            // 將新請求的結果存入緩存，並確保 Promise 鏈返回 Response
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
                // 確保鏈的最後返回 networkResponse
                return networkResponse;
            });
        }).catch(error => {
            console.error('[Service Worker] Fetch failed:', error);
            // 當網路請求失敗時，可以返回一個離線頁面或錯誤回應
            // 為了滿足類型檢查，我們需要返回一個 Response 物件
            // return caches.match('/offline.html'); 
            // 或者如果沒有離線頁面，可以返回一個簡單的錯誤回應
            return new Response("Network error happened", {
                status: 408,
                headers: { "Content-Type": "text/plain" },
            });
        });
    }));
});
