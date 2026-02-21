# Beamio

Beamio 是一款基于 Base 与 CoNET 的移动端支付与钱包应用，支持 USDC 转账、支付请求、Vouchers 与 Express Pay 等能力。

## 主要功能

- **Main Wallet (EOA)**：主钱包，支持 USDC 收发
- **Express Pay (AA)**：账户抽象钱包，支持智能路由与赞助 gas
- **Payment QR / Request**：生成支付 QR 或链接，接收 USDC 付款
- **x402 支付**：集成 EIP-3009 与 Coinbase CDP，支持 HTTP 402 支付流程
- **Vouchers**：凭证与联盟卡（CCSA）的购买、充值与消费

## 技术栈

- React + TypeScript
- Base（Ethereum L2）
- CoNET Layer Minus（去中心化物理基础设施）
- [Settle on Base](https://api.settleonbase.xyz) API

## History – Requesting 三种状态

交易列表中 Requesting 类记录的三种展示状态（`activeHistoryPannelNew.tsx` 中 `TxItemRow`）：

| 状态 | 判定条件 | Title | Subtitle |
|------|----------|-------|----------|
| **Pending** | `request_create` / `request_expired` 且未过期 | Payment QR | forText 或 "QR Generated" |
| **Expired** | `request_create` / `request_expired` 且已过期 | Request Expired | forText 或 "Link Invalidated" |
| **Fulfilled** | `request_fulfilled`（已支付完成） | Payment Received | "Paid by @" + beamioTag 或 "Paid by " + fullName/shortAddr |

| 状态 | 左侧 Icon | Icon 背景色 | 状态 Badge | 金额区 |
|------|-----------|--------------|------------|--------|
| Pending | QrCode | 橙色 (#FF9500) | Waiting | Pending |
| Expired | XCircle | 灰色 | Expired | Expired |
| Fulfilled | QrCode | 绿色 (#34C759) | Request | 实际金额（绿色） |

## License

Beamio is licensed under the MIT License (`MIT`), see [MIT_LICENSE](./MIT_LICENSE)
