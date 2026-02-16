# 动态 Manifest 支持方案（Nginx 与 API 层）

## 背景

PWA 的「添加到主屏幕」使用 manifest 的 `start_url`，而非当前页面 URL。需在 Master Key 页携带 `beamioTag`、`MasterKey` 参数时，`start_url` 必须动态指向当前完整 URL。

---

## 方案一：Nginx + njs（纯 Nginx 基础设施）

**适用**：已有 Nginx，希望尽量不引入额外后端。

[njs](https://nginx.org/en/docs/njs/index.html) 是 Nginx 的 JavaScript 模块，可用于动态生成 manifest JSON。

### 1. 安装 njs

```bash
# Ubuntu/Debian
apt-get install nginx-module-njs

# 或从源码编译，加载模块
load_module modules/ngx_http_js_module.so;
```

### 2. 编写 njs 脚本 `conf.d/manifest.js`

```javascript
// 参考 https://nginx.org/en/docs/njs/
function manifestHandler(r) {
  // 从查询参数 start_url 获取（前端传入），若无则用 Referer
  var startUrl = r.args.start_url;
  if (!startUrl) {
    startUrl = r.headersIn.Referer || r.headersIn.referer;
  }
  if (!startUrl) {
    startUrl = 'https://' + r.headersIn.Host + '/app/';
  }

  var manifest = {
    id: "/app/",
    short_name: "Beamio",
    name: "Beamio APP",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    theme_color: "#0d0d0d",
    background_color: "#0d0d0d",
    icons: [
      { src: "/app/logo192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/logo512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/logo512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };

  r.headersOut['Content-Type'] = 'application/manifest+json; charset=utf-8';
  r.return(200, JSON.stringify(manifest));
}

export default { manifestHandler };
```

### 3. Nginx 配置

```nginx
load_module modules/ngx_http_js_module.so;

http {
  js_import /etc/nginx/conf.d/manifest.js;  # 指向 njs 脚本路径

  server {
    listen 443 ssl;
    server_name beamio.app;

    # 动态 manifest：由 njs 根据 start_url 参数生成
    location = /app/manifest.json {
      js_content manifest.manifestHandler;
    }

    # 其他静态资源
    location /app/ {
      root /var/www/html;
      try_files $uri $uri/ /app/index.html;
    }
  }
}
```

### 4. 前端配合

在 `updateManifestStartUrl` 中，将 manifest 链接改为带参：

```javascript
// 将 link href 从 data URI 改为带参数的 URL
link.href = `${window.location.origin}/app/manifest.json?start_url=${encodeURIComponent(window.location.href)}`;
```

---

## 方案二：Nginx 反向代理到后端 API

**适用**：已有 Node / Go / Python 等 API 服务。

### 1. 后端示例（Node/Express）

```javascript
// GET /app/manifest.json?start_url=https://...
app.get('/app/manifest.json', (req, res) => {
  const startUrl = req.query.start_url || req.get('Referer') || `${req.protocol}://${req.get('host')}/app/`;
  const manifest = {
    id: "/app/",
    short_name: "Beamio",
    name: "Beamio APP",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    theme_color: "#0d0d0d",
    background_color: "#0d0d0d",
    icons: [...]
  };
  res.set('Content-Type', 'application/manifest+json');
  res.json(manifest);
});
```

### 2. Nginx 配置

```nginx
server {
  location = /app/manifest.json {
    proxy_pass http://backend_api/app/manifest.json;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Referer $http_referer;  # 传递 Referer
  }
}
```

---

## 方案三：纯 Nginx（无 njs，用 query 改写）

**适用**：不想用 njs，且请求路径可带参数。

思路：用 `rewrite` + 静态 manifest 模板，或重写到后端。纯 Nginx 无法根据 query 动态改写 JSON 内容，只能做转发。

```nginx
# 将带参请求代理到后端
location = /app/manifest.json {
  if ($args ~* start_url=) {
    proxy_pass http://backend;
  }
  try_files /app/manifest.static.json =404;  # 无参时用静态文件
}
```

要真正动态内容，仍需 njs 或后端。

---

## 方案四：OpenResty + Lua

**适用**：已在用 OpenResty。

```nginx
location = /app/manifest.json {
  default_type application/manifest+json;
  content_by_lua_block {
    local start_url = ngx.var.arg_start_url or ngx.var.http_referer or ("https://" .. ngx.var.host .. "/app/")
    local manifest = {
      start_url = start_url,
      -- ...
    }
    ngx.say(cjson.encode(manifest))
  }
}
```

---

## 推荐选择

| 方案         | 前置条件      | 复杂度 | 适用场景                 |
|--------------|---------------|--------|--------------------------|
| Nginx + njs  | 安装 njs 模块 | 中     | 希望纯 Nginx 解决        |
| Nginx + API  | 已有后端      | 低     | 已有 API，改动最少       |
| OpenResty    | 使用 OpenResty| 低     | 已有 Lua 能力            |
| 前端 data URI | 无            | 低     | 当前方案，部分浏览器兼容 |

---

## 前端与 Nginx 的衔接

采用 Nginx 动态 manifest 时，前端应改为使用 URL 而不是 data URI：

```typescript
// updateManifestStartUrl.ts - 使用服务端动态 manifest
export function updateManifestStartUrl(startUrl: string): void {
  const manifestUrl = `${window.location.origin}/app/manifest.json?start_url=${encodeURIComponent(startUrl)}`;
  const existing = document.querySelector('link[rel="manifest"]');
  if (existing) {
    existing.setAttribute('href', manifestUrl);
  } else {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);
  }
}
```

这样浏览器请求 manifest 时会带上 `start_url`，Nginx 或后端可据此返回正确的 manifest。
