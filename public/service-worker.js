"use strict";
/// <reference lib="webworker" />
const sw = self;
// 定義緩存的名稱和版本。更新 Service Worker 時，應該更改此版本號。
const CACHE_NAME = 'my-app-cache-v4';
// 需要特殊處理的 manifest.json 的 URL
const MANIFEST_URL = '/manifest.json';
// App Shell：應用核心靜態資源，在安裝時預先快取
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/favicon.ico',
    '/assets/info.svg',
    '/assets/silent-pass-logo-grey.png',
    '/manifest.json',
    '/assets/header-title.svg',
    'https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/us.svg',
    '/static/media/Referrals.45a4b5437d546356ff91.png',
    '/static/media/language.43d120a2e74e3c4818090a317f997652.svg',
    '/static/media/help.e84a33a3a76e89bf3daf58baf1189fe8.svg',
    '/static/media/extra-reward.25c85d3bfc3b9df10349de5fbcecf30e.svg',
    '/static/media/split-tunneling.9e6f6574614b30a8fa5483b6e26b49af.svg',
    '/static/media/proxy-information.a87fdb94d52988a7fd427524bea13837.svg',
    '/assets/copy-purple.svg',
    '/service-worker.js',
    '/logo192.png',
    MANIFEST_URL
];
/**
 * 安裝事件 (install)
 * 使用 sw 取代 self，並為 event 參數提供正確的類型。
 */
sw.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
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
    console.log('[Service Worker] Activate');
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
sw.addEventListener('fetch', (event) => {
    const { request } = event;
    // --- 針對 manifest.json 的特殊處理：Stale-While-Revalidate ---
    if (request.url.endsWith(MANIFEST_URL)) {
        event.respondWith(caches.open(CACHE_NAME).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            });
        }));
        return; // 結束執行
    }
    // --- 對於其他請求：Cache First (Network Fallback) ---
    //   event.respondWith(
    //     caches.match(request).then((cachedResponse) => {
    //       // 如果緩存中有匹配的資源，直接返回
    //     //   if (cachedResponse) {
    //     //     return cachedResponse;
    //     //   }
    //       // 否則，從網路請求
    //       return fetch(request).then((networkResponse) => {
    //         // 檢查是否是有效的回應
    //         if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
    //           return networkResponse;
    //         }
    //         // 複製一份回應，因為 request 和 cache 都需要使用它
    //         // const responseToCache = networkResponse.clone();
    //         // 將新請求的結果存入緩存，並確保 Promise 鏈返回 Response
    //         return caches.open(CACHE_NAME).then(cache => {
    //           cache.put(request, responseToCache);
    //           // 確保鏈的最後返回 networkResponse
    //           return networkResponse;
    //         });
    //       }).catch(error => {
    //         console.error('[Service Worker] Fetch failed:', error);
    //         // 當網路請求失敗時，可以返回一個離線頁面或錯誤回應
    //         // 為了滿足類型檢查，我們需要返回一個 Response 物件
    //         // return caches.match('/offline.html'); 
    //         // 或者如果沒有離線頁面，可以返回一個簡單的錯誤回應
    //         return new Response("Network error happened", {
    //           status: 408,
    //           headers: { "Content-Type": "text/plain" },
    //         });
    //       });
    //     })
    //   );
});
