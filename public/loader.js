"use strict";

const sw = self;

// 快取名稱：為 loader 和它所承載的 App 內容定義一個清晰的名稱
// 每次更新 REACT_APP_URLS 時，建議更改版本號以觸發 Service Worker 的更新
const CACHE_NAME = 'react-app-loader-cache-v52';
// 遠端 React 應用程式的基礎 URL

const PROXY_SCHEME_BASE_URL = 'app-x-local-proxy://';
const REMOTE_SERVER_BASE_URL = 'http://localhost:3001/'; // 本地伺服器
//	curl localhost:3001/static/css/main.b71dcddc.css

const REACT_APP_PATHS = [
  // 核心 HTML
  '/index.html',

  // React App 自己的 Service Worker
//   '/service-worker.js',
//   '/service-worker.js.map',

  // 其他根目錄下的靜態資源
  '/manifest.json',
  '/favicon.ico',
  // 如果有其他 logo 或圖片，也需要加入
  '/logo192.png',
  '/logo512.png',

  // 主要的 JavaScript 檔案 (檔名中的 hash 會變化)
  '/static/js/main.8ef81ffb.js',
  '/static/js/main.8ef81ffb.js.map',
  '/static/js/453.a5cbc0be.chunk.js',
  '/static/js/453.a5cbc0be.chunk.js.map',
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

// --- [新增] 輔助函數：從 HTML 文本中解析核心資源路徑 ---
function parseAssetUrlsFromHtml(htmlText) {
    // 使用正規表示式尋找 main.xxxx.css 和 main.xxxx.js 的路徑
    const cssMatch = htmlText.match(/href="(\/static\/css\/main\.[a-f0-9]+\.css)"/);
    const jsMatch = htmlText.match(/src="(\/static\/js\/main\.[a-f0-9]+\.js)"/);
    
    return {
        css: cssMatch ? cssMatch[1] : null,
        js: jsMatch ? jsMatch[1] : null,
    };
}

// --- [新增] 輔助函數：獲取當前快取中的核心資源路徑 ---
async function getCachedAssetUrls() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndexResponse = await cache.match('/index.html');
        if (!cachedIndexResponse) return { css: null, js: null };

        const cachedHtmlText = await cachedIndexResponse.text();
        return parseAssetUrlsFromHtml(cachedHtmlText);
    } catch (error) {
        console.error('[Loader SW] Error getting cached asset URLs:', error);
        return { css: null, js: null };
    }
}

// --- [修改] 智能更新的核心邏輯，現在使用 fetchWithFallback ---
async function performSmartUpdate() {
    console.log('[Loader SW] Performing smart update check in background...');
    
    try {
        // 1. 使用帶有備援機制的 fetch 獲取最新的 index.html
        const networkResponse = await fetchWithFallback('/index.html');
        const newHtmlText = await networkResponse.clone().text();

        // 2. 解析新舊 HTML，比較資源路徑
        const newAssets = parseAssetUrlsFromHtml(newHtmlText);
        const currentAssets = await getCachedAssetUrls();

        console.log('[Loader SW] Current assets:', currentAssets);
        console.log('[Loader SW] New assets found in remote HTML:', newAssets);

        // 3. 如果資源路徑沒有變化，則無需更新
        if (!newAssets.js || newAssets.js === currentAssets.js) {
            console.log('[Loader SW] No new version found. Update check complete.');
            return;
        }

        console.log(`[Loader SW] New version detected! Starting atomic update...`);

        // 4. 原子化下載：使用 fetchWithFallback 下載所有新資源
        const newPathsToCache = ['/index.html', newAssets.js, newAssets.css].filter(Boolean);
        const cache = await caches.open(CACHE_NAME);

        const cachePromises = newPathsToCache.map(path => {
            // 注意：我們需要將請求的路徑作為快取的 key
            const requestKey = path;
            return fetchWithFallback(path).then(response => cache.put(requestKey, response));
        });

        await Promise.all(cachePromises);
        console.log('[Loader SW] Atomic update successful! New version is ready for next launch.');

    } catch (error) {
        console.error('[Loader SW] Smart update process failed from all servers:', error);
    }
}


// [新增] 將遠端更新伺服器定義為一個列表，包含主伺服器和備援伺服器
const REMOTE_UPDATE_SERVERS = [
    'https://ios-test.silentpass.io',
    'https://vpn9.conet.network'
];

// --- [新增] 帶有備援機制的網路請求函數 ---
async function fetchWithFallback(path) {
    // 遍歷伺服器列表
    for (const baseUrl of REMOTE_UPDATE_SERVERS) {
        const url = `${baseUrl}${path}`;
        try {
            console.log(`[Loader SW] Attempting to fetch from: ${url}`);
            // 使用 no-store 確保獲取的是伺服器上的最新版本
            const response = await fetch(url, { cache: 'no-store' });
            
            // 如果請求成功 (狀態碼 2xx)，則立即返回回應
            if (response.ok) {
                console.log(`[Loader SW] Successfully fetched from: ${url}`);
                return response;
            }
            // 如果伺服器有回應但狀態不正確 (例如 404, 500)，也視為失敗
            console.warn(`[Loader SW] Fetch from ${url} failed with status: ${response.status}`);
        } catch (error) {
            // 如果發生網路層級的錯誤 (例如 DNS 錯誤, 無法連線)，則記錄錯誤並嘗試下一個
            console.warn(`[Loader SW] Network error fetching from ${url}. Trying next server. Error:`, error);
        }
    }
    // 如果所有伺服器都嘗試失敗，則拋出最終錯誤
    throw new Error(`Failed to fetch ${path} from all available servers.`);
}

// --- [最終修正版] ---
sw.addEventListener('install', (event) => {
    console.log(`[Loader SW] Install event started. ${CACHE_NAME}`);
    const installPromise = determineBaseUrl().then(baseUrl => {
        console.log(`[Loader SW] Caching initial assets from base URL: ${baseUrl}`);
        return caches.open(CACHE_NAME).then(cache => {
            const cachePromises = REACT_APP_PATHS.map(path => {
                const remoteUrl = `${baseUrl}${path.startsWith('/') ? path.substring(1) : path}`;
                return fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) throw new Error(`Fetch failed for ${remoteUrl} with status ${response.status}`);
                        const cacheKey = (path === '/') ? '/index.html' : path;
                        return cache.put(cacheKey, response);
                    })
                    .catch(err => {
                        console.error(`[Loader SW] FAILED to fetch or cache file: ${remoteUrl}`, err);
                        throw err;
                    });
            });
            return Promise.all(cachePromises);
        });
    }).then(() => {
        console.log('[Loader SW] SUCCESS: All files were cached successfully.');
        return sw.skipWaiting();
    }).catch(err => {
        console.error('[Loader SW] FATAL: The installation process failed.', err);
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

// [新增] 輔助函數：在背景從遠端伺服器獲取更新
async function fetchAndRevalidate(request) {
    console.log('[Loader SW] Starting background revalidation from remote server...');
    try {
        // 組合遠端伺服器的 URL
        const remoteUrl = `${REMOTE_UPDATE_SERVER_URL}${new URL(request.url).pathname}`;
        
        // 向遠端伺服器發起網路請求
        // 這個請求會自動觸發瀏覽器對 loader.js 的更新檢查
        const networkResponse = await fetch(remoteUrl);

        if (networkResponse.ok) {
            // 如果成功獲取，用新的回應更新快取
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            console.log(`[Loader SW] Background update for ${request.url} successful.`);
            return networkResponse;
        }
    } catch (error) {
        // 背景更新失敗是可接受的，因為用戶已經看到了快取版本
        console.warn(`[Loader SW] Background update check failed. Device might be offline. Error:`, error);
    }
}



// fetch 事件：從快取中提供 React App 的資源
sw.addEventListener('fetch', (event) => {
    const { request } = event;
	const url = new URL(event.request.url);
	
    if (request.mode === 'navigate') {
        console.log('[Loader SW] SWR for navigation: Serving from cache, while revalidating in background...');
        event.respondWith(
            caches.match('/index.html', { cacheName: CACHE_NAME }).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                return determineBaseUrl().then(baseUrl => fetch(`${baseUrl}/index.html`));
            })
        );
        event.waitUntil(performSmartUpdate());
        return;
    }

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            return cachedResponse || fetch(request);
        })
    );

});