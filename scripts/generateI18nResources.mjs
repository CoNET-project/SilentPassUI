#!/usr/bin/env node
/**
 * 从 localizeToZh.mjs 的 ZH 表 + 服务端错误表生成 en.json / zh-CN.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZH as UI_EN_ZH } from './localizeToZh.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALE_DIR = path.join(__dirname, '../src/locale')

/** x402sdk / API 常见英文 error → i18n key（值为英文默认文案） */
const SERVER_ERRORS = {
	generic: 'Something went wrong. Please try again.',
	network: 'Network error. Please check your connection and retry.',
	requestFailed: 'Request failed.',
	signFailed: 'Sign failed.',
	queryFailed: 'Query failed.',
	prepareFailed: 'Prepare failed.',
	invalidPrepareResponse: 'Invalid prepare response.',
	claimFailed: 'Claim failed.',
	refuelFailed: 'Refuel failed.',
	redeemFailed: 'Redeem failed.',
	uploadFailed: 'Upload failed.',
	createFailed: 'Create failed.',
	copyFailed: 'Copy failed.',
	linkFailed: 'Link failed.',
	cancelFailed: 'Cancel failed.',
	signerMismatch: 'Signer address does not match claimant.',
	cardContractNotFound: 'Card contract not found.',
	missingTagOrUid: 'Missing tagid or uid.',
	noActiveLinkSession: 'No active link session for this tag.',
	uidMismatch: 'uid mismatch.',
	counterMismatch: 'counter mismatch.',
	nftRedeemcodeMismatch: 'nftRedeemcode mismatch.',
	missingNftRedeemcode: 'Missing nftRedeemcode for this link session.',
	noOnChainRedeem: 'This session has no on-chain redeem; nftRedeemcode should be empty or null.',
	invalidAmount: 'Invalid amount.',
	missingCardAddress: 'Missing or invalid cardAddress.',
	missingTarget: 'Missing or invalid target.',
	oracleUnavailable: 'Oracle rate unavailable, please retry shortly.',
	quotePointsFailed: 'quotePointsForUSDC failed.',
	serviceAdminKeyMissing: 'Service admin private key not configured.',
	signerNotCardAdmin: 'Signer is not card admin.',
	insufficientBUnits: 'Insufficient B-Units for this operation.',
	insufficientBalance: 'Insufficient balance.',
	insufficientChargeReward: 'Insufficient charge-reward points.',
	recipientNoBeamioAccount: 'Recipient has no Beamio account. Please activate the Beamio app first.',
	walletNotReady: 'Wallet is not ready yet.',
	unlockWalletToContinue: 'Unlock your wallet with your access password to continue.',
	unlockWalletToClaim: 'Unlock your wallet with your access password to claim coupons.',
	redeemLinkMissingCard: 'Redeem link is missing a valid card address.',
	redeemLinkInvalid: 'Redeem link is invalid or wallet is not ready.',
	couponLinkInvalid: 'Coupon link is invalid or wallet is not ready.',
	couponClaimInvalid: 'Coupon claim parameters are invalid.',
	expressPayNotFound: 'Express Pay not found. Please create or link Express Pay first.',
	expressPaySameAsEoa: 'Express Pay address cannot be the same as your EOA.',
	failedExpressPayAddress: 'Failed to get Express Pay address.',
	currencyRequired: 'Currency is required for accounting.',
	aaToEoaFailed: 'AA to EOA transfer failed.',
	bunitBalanceCheckFailed: 'B-Unit balance check failed.',
	noSigningKey: 'No signing key available.',
	noReceivingAddress: 'No receiving address found.',
	invalidAmountInput: 'Please enter a valid amount.',
	loginRequired: 'Please sign in to your Beamio account first.',
	addressRequired: 'Address is required.',
	invalidRedeemCode: 'Invalid redeem code.',
	rpcError: 'RPC error.',
	searchFailed: 'Search failed. Try again.',
	loginFailed: 'Login failed, please try again later.',
	invalidBeamioTag: 'Invalid Beamio Tag or Recovery Password, please try again',
}

const SERVER_ERROR_ZH = {
	generic: '出了点问题，请重试。',
	network: '网络错误，请检查连接后重试。',
	requestFailed: '请求失败。',
	signFailed: '签名失败。',
	queryFailed: '查询失败。',
	prepareFailed: '预检失败。',
	invalidPrepareResponse: '预检响应无效。',
	claimFailed: '领取失败。',
	refuelFailed: '补充燃料失败。',
	redeemFailed: '兑换失败。',
	uploadFailed: '上传失败。',
	createFailed: '创建失败。',
	copyFailed: '复制失败。',
	linkFailed: '关联失败。',
	cancelFailed: '取消失败。',
	signerMismatch: '签名地址与 claimant 不一致。',
	cardContractNotFound: '未找到卡合约。',
	missingTagOrUid: '缺少 tagid 或 uid。',
	noActiveLinkSession: '此标签无有效关联会话。',
	uidMismatch: 'uid 不匹配。',
	counterMismatch: 'counter 不匹配。',
	nftRedeemcodeMismatch: 'nftRedeemcode 不匹配。',
	missingNftRedeemcode: '此关联会话缺少 nftRedeemcode。',
	noOnChainRedeem: '此会话无链上兑换；nftRedeemcode 应为空。',
	invalidAmount: '金额无效。',
	missingCardAddress: '缺少或无效的 cardAddress。',
	missingTarget: '缺少或无效的 target。',
	oracleUnavailable: '预言机汇率暂不可用，请稍后重试。',
	quotePointsFailed: 'quotePointsForUSDC 失败。',
	serviceAdminKeyMissing: '未配置服务端 admin 私钥。',
	signerNotCardAdmin: '签名者不是卡 admin。',
	insufficientBUnits: 'B-Unit 不足，无法完成此操作。',
	insufficientBalance: '余额不足。',
	insufficientChargeReward: 'charge-reward 点数不足。',
	recipientNoBeamioAccount: '收款方尚未激活 Beamio 账户，请先激活 App。',
	walletNotReady: '钱包尚未就绪。',
	unlockWalletToContinue: '请使用访问密码解锁钱包后继续。',
	unlockWalletToClaim: '请使用访问密码解锁钱包以领取优惠券。',
	redeemLinkMissingCard: '兑换链接缺少有效的卡地址。',
	redeemLinkInvalid: '兑换链接无效或钱包未就绪。',
	couponLinkInvalid: '优惠券链接无效或钱包未就绪。',
	couponClaimInvalid: '优惠券领取参数无效。',
	expressPayNotFound: '未找到快捷支付，请先创建或关联。',
	expressPaySameAsEoa: '快捷支付地址不能与 EOA 相同。',
	failedExpressPayAddress: '获取快捷支付地址失败。',
	currencyRequired: '记账需要指定币种。',
	aaToEoaFailed: 'AA 转 EOA 失败。',
	bunitBalanceCheckFailed: 'B-Unit 余额检查失败。',
	noSigningKey: '无可用签名密钥。',
	noReceivingAddress: '未找到收款地址。',
	invalidAmountInput: '请输入有效金额。',
	loginRequired: '请先登录 Beamio 账户。',
	addressRequired: '需要地址。',
	invalidRedeemCode: '无效的兑换码。',
	rpcError: 'RPC 错误。',
	searchFailed: '搜索失败，请重试。',
	loginFailed: '登录失败，请稍后重试。',
	invalidBeamioTag: 'Beamio Tag 或恢复密码无效，请重试',
}

function slugify(en) {
	return (
		en
			.replace(/['"]/g, '')
			.replace(/[^a-zA-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.toLowerCase()
			.slice(0, 72) || 'text'
	)
}

function buildUiResources() {
	const en = {}
	const zh = {}
	const zhToKey = {}
	const used = new Set()
	for (const [english, chinese] of Object.entries(UI_EN_ZH)) {
		let key = slugify(english)
		let n = 2
		while (used.has(key)) {
			key = `${slugify(english).slice(0, 68)}_${n++}`
		}
		used.add(key)
		en[key] = english
		zh[key] = chinese
		zhToKey[chinese] = key
	}
	return { en, zh, zhToKey }
}

function buildErrorResources() {
	const en = { ...SERVER_ERRORS }
	const zh = { ...SERVER_ERROR_ZH }
	return { en, zh }
}

function buildTimeResources() {
	const en = {
		minutesAgo: '{{count}}m ago',
		hoursAgo: '{{count}}h ago',
		yesterday: 'Yesterday',
		dateTime: '{{month}} {{day}}, {{time}}',
		emDash: '—',
		couponValidNow: 'VALID NOW',
		couponNoExpiry: 'NO EXPIRY',
		couponExpired: 'EXPIRED',
		couponExpiresDays: 'EXPIRES IN {{count}}D',
		couponExpiresHours: 'EXPIRES IN {{count}}H',
		couponExpiresMinutes: 'EXPIRES IN {{count}}M',
		couponClaimed: 'Coupon claimed{{tokenSuffix}}!',
		couponClaimedToken: ' (token {{tokenId}})',
	}
	const zh = {
		minutesAgo: '{{count}} 分钟前',
		hoursAgo: '{{count}} 小时前',
		yesterday: '昨天',
		dateTime: '{{month}}{{day}}日 {{time}}',
		emDash: '—',
		couponValidNow: '现可领取',
		couponNoExpiry: '无到期',
		couponExpired: '已过期',
		couponExpiresDays: '{{count}} 天后过期',
		couponExpiresHours: '{{count}} 小时后过期',
		couponExpiresMinutes: '{{count}} 分钟后过期',
		couponClaimed: '优惠券已领取{{tokenSuffix}}！',
		couponClaimedToken: '（代币 {{tokenId}}）',
	}
	return { en, zh }
}

const ui = buildUiResources()
const errors = buildErrorResources()
const time = buildTimeResources()

const enJson = { ui: ui.en, errors: errors.en, time: time.en }
const zhJson = { ui: ui.zh, errors: errors.zh, time: time.zh }

fs.mkdirSync(LOCALE_DIR, { recursive: true })
fs.writeFileSync(path.join(LOCALE_DIR, 'en.json'), JSON.stringify(enJson, null, 2) + '\n')
fs.writeFileSync(path.join(LOCALE_DIR, 'zh-CN.json'), JSON.stringify(zhJson, null, 2) + '\n')
fs.writeFileSync(
	path.join(LOCALE_DIR, 'zhToUiKey.json'),
	JSON.stringify(ui.zhToKey, null, 2) + '\n',
)
console.log(`Wrote ${Object.keys(ui.en).length} ui keys, ${Object.keys(errors.en).length} error keys`)
