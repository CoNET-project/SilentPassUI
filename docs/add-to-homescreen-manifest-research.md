# Add to Home Screen 与 Manifest 调研结论

## 问题

在系统的「Add to Home Screen」表单中，地址栏仍不包含 `beamioTag`、`MasterKey` 等参数。UI 端通过 data URI 动态替换 manifest 的方案似乎无效。

---

## 调研结论

### 1. Manifest 何时被获取？

**关键发现：Manifest 通常在页面首次加载时就被获取并缓存。**

> "the manifest will usually be fetched at the start"  
> — [Stack Overflow](https://stackoverflow.com/questions/10887676/can-the-url-for-the-add-to-home-screen-on-iphone-safari-be-customized)

- 浏览器在解析到 `<link rel="manifest" href="/app/manifest.json">` 时，会发起对 manifest 的请求
- 请求结果会被缓存，供后续「Add to Home Screen」使用
- 之后通过 JS 修改 manifest link（如改为 data URI），多数情况下**不会再触发重新获取**，仍会使用已缓存的 manifest

### 2. Add to Home Screen 的 URL 来源

| 平台 | 使用的 URL 来源 |
|------|-----------------|
| **Android / Chrome** | Manifest 的 `start_url`（首次加载时拉取并缓存） |
| **iOS Safari** | **当前页面 URL**（地址栏），通常**忽略** manifest 的 `start_url` |

### 3. 为何 UI 端方案效果有限？

1. **Android / Chrome**：manifest 在首次加载时就已从 `/app/manifest.json` 拉取，`start_url` 固定为 `/app/`。之后通过 data URI 替换 `<link rel="manifest">`，一般不会触发重新拉取，仍用旧 manifest。
2. **iOS Safari**：按理使用当前页面 URL，若 `history.replaceState()` 已把地址栏更新为带参数的 URL，理论上应能生效。若仍不生效，可能原因包括：
   - `replaceState` 未成功更新地址栏（例如处于特殊上下文）
   - 当前并非 iOS 环境
   - 系统在展示「Add to Home Screen」表单时，仍从 manifest 读取了信息

### 4. 结论：纯 UI 方案的局限

- **Add to Home Screen 的 URL 主要来自网站提供的 manifest**，而不是实时读取当前 DOM 中的 manifest link
- Manifest 在页面 load 阶段就被拉取并缓存，后续通过 data URI 动态替换通常**不会覆盖已缓存内容**
- 因此，**仅靠前端替换 manifest link 的 UI 方案，在多数浏览器上难以可靠生效**

---

## 可行方案

### 方案 A：服务端动态 manifest（推荐）

在 Nginx 或 API 层按 `start_url` 查询参数返回对应 manifest：

```
GET /app/manifest.json?start_url=https://beamio.app/?beamioTag=xxx&MasterKey=yyy
→ 返回 start_url 为该 URL 的 manifest
```

前端在 Master Key 页将 manifest link 改为：

```html
<link rel="manifest" href="/app/manifest.json?start_url=ENCODED_CURRENT_URL">
```

详见：`docs/dynamic-manifest-nginx.md`

### 方案 B：延迟注入 manifest（可尝试，但兼容性不确定）

1. 从 `index.html` 中**移除**初始的 `<link rel="manifest">`
2. 在 React 首次渲染时注入默认 manifest（`start_url: /app/`）
3. 在 Master Key 页将 manifest 更新为带参的 data URI

目的是避免页面 load 时就拉取静态 manifest，让后续注入的 manifest 有机会被采用。但不同浏览器是否会在「首次需要 manifest 时」重新解析并拉取，行为可能不一。

### 方案 C：iOS 专用逻辑

若目标主要是 iOS，可利用其使用「当前页面 URL」的行为：

1. 在进入 Master Key 页时执行 `history.replaceState()` 更新地址栏
2. 确认地址栏中已包含完整 URL 和参数
3. 再提示用户执行「Add to Home Screen」

若仍无效，需排查是否处于 iframe、PWA 内嵌等特殊环境，导致地址栏与系统所读 URL 不一致。

---

## 建议

- **首选：方案 A（服务端动态 manifest）**：行为最可控，兼容性最好。
- **快速验证：方案 C**：在 iOS 上重点确认 `replaceState` 后地址栏是否正确，以及系统表单中的 URL 是否随之变化。
- 纯前端 data URI 替换方案在多数环境下难以改变已被缓存的 manifest，不建议作为主方案依赖。
