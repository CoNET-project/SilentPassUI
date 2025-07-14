"use strict";

const sw = self;

// 快取名稱：為 loader 和它所承載的 App 內容定義一個清晰的名稱
// 每次更新 REACT_APP_URLS 時，建議更改版本號以觸發 Service Worker 的更新
const CACHE_NAME = 'react-app-loader-cache-v35';
// 遠端 React 應用程式的基礎 URL

const PROXY_SCHEME_BASE_URL = 'app-x-local-proxy://';
const REMOTE_SERVER_BASE_URL = 'http://localhost:3001/'; // 本地伺服器
//	curl localhost:3001/static/css/main.b71dcddc.css

const REACT_APP_PATHS = [
  // 核心 HTML
  '/index.html',

  // React App 自己的 Service Worker
  '/service-worker.js',
  '/service-worker.js.map',

  // 其他根目錄下的靜態資源
  '/manifest.json',
  '/favicon.ico',
  // 如果有其他 logo 或圖片，也需要加入
  '/logo192.png',
  '/logo512.png',

  // 主要的 JavaScript 檔案 (檔名中的 hash 會變化)
  '/static/js/main.2303edb2.js',
  '/static/js/main.2303edb2.js.map',
  '/static/js/453.a5cbc0be.chunk.js',
  '/static/js/453.a5cbc0be.chunk.js.map',
  // '/static/js/787.xxxxxxxx.js', // Create React App 通常會有一個 vendors chunk
  '/assets/info.svg',
  '/assets/silent-pass-logo-grey.png',

  // 主要的 CSS 檔案 (檔名中的 hash 會變化)
  '/static/css/main.b71dcddc.css',
  '/static/css/main.b71dcddc.css.map',
];
/**
 * 偵測當前環境並決定使用哪個基礎 URL。
 * @returns {Promise<string>} 返回應該使用的 baseURL。
 */

// 為了快速查找，將路徑陣列轉換為 Set
const managedPaths = new Set(REACT_APP_PATHS);

async function determineBaseUrl() {
    console.log('[Loader SW] Determining environment...');
    try {
        // 嘗試請求一個自訂協定的 "ping" URL。
        // 這個請求會被我們的 WKURLSchemeHandler 攔截。
        // 我們需要在 handler 中對 "/ping" 路徑做一個簡單的成功回應。
        await fetch(`${PROXY_SCHEME_BASE_URL}/ping`)
        console.log('[Loader SW] Native proxy detected. Using local proxy.')
        return PROXY_SCHEME_BASE_URL
    } catch (error) {
        // 如果 fetch 失敗，說明不在 WKWebView 環境中。
        console.log('[Loader SW] Native proxy not found. Using remote server.')
        return REMOTE_SERVER_BASE_URL
    }
}


// --- [最終修正版] ---
sw.addEventListener('install', (event) => {
    console.log('[Install] Event started.');

    const installPromise = determineBaseUrl().then(baseUrl => {
        console.log(`[Install] Base URL determined: ${baseUrl}`);
        
        // 使用巢狀 .then() 來保持 'baseUrl' 在正確的範疇內
        return caches.open(CACHE_NAME).then(cache => {
            console.log(`[Install] Cache "${CACHE_NAME}" opened successfully.`);

            const cachePromises = REACT_APP_PATHS.map(path => {
                const remoteUrl = `${baseUrl}${path.startsWith('/') ? path.substring(1) : path}`;
                
                // 每個 fetch 都有自己的 catch，以便精確定位錯誤
                return fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Fetch failed for ${remoteUrl} with status ${response.status}`);
                        }
                        const cacheKey = (path === '/') ? '/index.html' : path;
                        return cache.put(cacheKey, response);
                    })
                    .catch(err => {
                        // 如果單一檔案 fetch 失敗，打印詳細日誌並重新拋出錯誤
                        console.error(`[Install] FAILED to fetch or cache file: ${remoteUrl}`, err);
                        throw err;
                    });
            });

            // Promise.all 會因為上面任何一個 re-throw 的錯誤而失敗
            return Promise.all(cachePromises);
        });

    }).then(() => {
        console.log('[Install] SUCCESS: All files were cached successfully.');
        return sw.skipWaiting();
    }).catch(err => {
        // 這是整個安裝流程的最終防線，捕捉所有未被處理的錯誤
        console.error('[Install] FATAL: The installation process failed.', err);
        // 此處不需要再 throw，因為 Promise 鏈的失敗本身就會阻止 Service Worker 的安裝
    });

    event.waitUntil(installPromise);
});

// activate 事件：清理舊版本的快取
sw.addEventListener('activate', (event) => {
    console.log('[Install] [Loader SW] Activate event: Cleaning up old caches and taking control.');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
					if (/^react\-app\-loader\-cache\-/.test(cacheName)) {
						// 刪除所有不等於當前 CACHE_NAME 的快取
						if (cacheName !== CACHE_NAME) {
							console.log(`[Install][Loader SW] Deleting old cache: [${cacheName}] cacheName !== CACHE_NAME [${CACHE_NAME}] ${cacheName !== CACHE_NAME}`);
							return caches.delete(cacheName);
						}
					}
                    
                })
            );
        }).then(() => {
            // 立即控制所有客戶端（頁面）
            return sw.clients.claim();
        })
    );
});

// --- [新增] 輔助函數：在 Workbox 的快取中尋找 index.html ---
async function findIndexHtmlInWorkboxCache() {
    // 取得所有快取的名稱
    const cacheNames = await caches.keys();
    
    // 尋找由 Workbox precache 插件建立的快取
    // 注意：這個前綴是基於目前 Workbox 的慣例，未來可能有變
    const workboxCacheName = cacheNames.find(name => name.startsWith('workbox-precache-'));

    if (workboxCacheName) {
        console.log(`[Loader SW] Found Workbox cache: ${workboxCacheName}`);
        const workboxCache = await caches.open(workboxCacheName);
        const cachedResponse = await workboxCache.match('/index.html');
        if (cachedResponse) {
            console.log('[Loader SW] Found index.html in Workbox cache.');
            return cachedResponse;
        }
    }

    console.warn('[Loader SW] Could not find index.html in any Workbox cache.');
    // 如果找不到，提供一個後備方案（例如從 loader 自己的快取或網路）
    const loaderCache = await caches.open(CACHE_NAME);
    return loaderCache.match('/index.html');
}


// fetch 事件：從快取中提供 React App 的資源
sw.addEventListener('fetch', (event) => {
    const { request } = event;
	const url = new URL(event.request.url);
	
    // ====================== 核心修改點 ======================
    // 如果請求是主導航請求（即用戶直接訪問或刷新頁面）
    // 我們優先嘗試從網路獲取，讓新的 Service Worker 有機會接管
    // --- 策略 2: 處理對 loader.html 的導航請求 ---
    // 如果用戶訪問載入頁，我們去 Workbox 快取中尋找最新的 index.html。
    if (request.mode === 'navigate' && url.pathname.endsWith('/loader.html')) {
        console.log('[Loader SW] Navigation to loader.html intercepted. Finding latest index.html from Workbox cache.');
        event.respondWith(findIndexHtmlInWorkboxCache());

		// **同時**，在背景觸發一個網路請求。
        // 這個請求的目的是觸發瀏覽器內建的、對 loader.js 的更新檢查。
        // 我們不需要使用這個請求的回應，只是確保它被執行。
        event.waitUntil(
            fetch(request).catch(err => {
                // 背景更新失敗也沒關係，因為我們已經提供了快取版本
                console.warn('[Loader SW] Background update check failed.', err);
            })
        );
		
        return;
    }

	// 檢查請求的路徑是否在 loader 的管理範圍內
    if (managedPaths.has(url.pathname)) {
        // 如果是，採用「快取優先，網路後備」策略來回應
        console.log(`[Loader SW] Handling request for its own resource: ${url.pathname}`);
        event.respondWith(
            caches.match(event.request, { cacheName: CACHE_NAME }).then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
    }

	// --- 策略 3: 放行所有其他請求 ---
    // 對於所有不由 loader 管理的請求，我們什麼都不做，讓它們穿透過去，
    // 交由內層的 service-worker.js 或網路直接處理。
    // console.log(`[Loader SW] Passing through request for ${url.pathname}`);

});