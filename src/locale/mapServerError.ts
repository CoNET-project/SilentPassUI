import en from './en.json'
import { t } from './i18n'

type ErrorKey = keyof typeof en.errors

/** English API error text → i18n errors.* key */
const EXACT_EN_TO_KEY: Record<string, ErrorKey> = {}
for (const [key, value] of Object.entries(en.errors)) {
	if (typeof value === 'string' && value.trim()) {
		EXACT_EN_TO_KEY[value.trim()] = key as ErrorKey
	}
}

/** Case-insensitive / substring patterns for dynamic server messages */
const ERROR_PATTERNS: Array<{ test: RegExp; key: ErrorKey }> = [
	{ test: /signer is not card admin/i, key: 'signerNotCardAdmin' },
	{ test: /insufficient b-?units?/i, key: 'insufficientBUnits' },
	{ test: /insufficient balance/i, key: 'insufficientBalance' },
	{ test: /insufficient charge-reward/i, key: 'insufficientChargeReward' },
	{ test: /network error|failed to fetch|network request failed/i, key: 'network' },
	{ test: /oracle rate unavailable/i, key: 'oracleUnavailable' },
	{ test: /quotePointsForUSDC failed/i, key: 'quotePointsFailed' },
	{ test: /uid mismatch/i, key: 'uidMismatch' },
	{ test: /counter mismatch/i, key: 'counterMismatch' },
	{ test: /nftRedeemcode mismatch/i, key: 'nftRedeemcodeMismatch' },
	{ test: /missing nftRedeemcode/i, key: 'missingNftRedeemcode' },
	{ test: /no active link session/i, key: 'noActiveLinkSession' },
	{ test: /missing tagid or uid/i, key: 'missingTagOrUid' },
	{ test: /card contract not found/i, key: 'cardContractNotFound' },
	{ test: /signer address does not match/i, key: 'signerMismatch' },
	{ test: /wallet is not ready/i, key: 'walletNotReady' },
	{ test: /unlock your wallet with your access password to claim/i, key: 'unlockWalletToClaim' },
	{ test: /unlock your wallet with your access password to continue/i, key: 'unlockWalletToContinue' },
	{ test: /redeem link is missing a valid card address/i, key: 'redeemLinkMissingCard' },
	{ test: /redeem link is invalid/i, key: 'redeemLinkInvalid' },
	{ test: /coupon link is invalid/i, key: 'couponLinkInvalid' },
	{ test: /coupon claim parameters are invalid/i, key: 'couponClaimInvalid' },
	{ test: /express pay not found|express pay address/i, key: 'expressPayNotFound' },
	{ test: /cannot be the same as your eoa/i, key: 'expressPaySameAsEoa' },
	{ test: /currency is required for accounting/i, key: 'currencyRequired' },
	{ test: /aa to eoa transfer failed/i, key: 'aaToEoaFailed' },
	{ test: /b-?unit balance check failed/i, key: 'bunitBalanceCheckFailed' },
	{ test: /no signing key/i, key: 'noSigningKey' },
	{ test: /request failed/i, key: 'requestFailed' },
	{ test: /sign failed/i, key: 'signFailed' },
	{ test: /prepare failed/i, key: 'prepareFailed' },
	{ test: /claim failed/i, key: 'claimFailed' },
	{ test: /redeem failed/i, key: 'redeemFailed' },
	{ test: /upload failed/i, key: 'uploadFailed' },
	{ test: /create failed/i, key: 'createFailed' },
	{ test: /copy failed/i, key: 'copyFailed' },
	{ test: /invalid redeem code/i, key: 'invalidRedeemCode' },
	{ test: /rpc error/i, key: 'rpcError' },
]

/** Already-localized zh-CN error text → key (when API returns cached zh or client fallback) */
const ZH_TO_KEY: Record<string, ErrorKey> = {
	'请求失败。': 'requestFailed',
	请求失败: 'requestFailed',
	'签名失败。': 'signFailed',
	签名失败: 'signFailed',
	'兑换失败': 'redeemFailed',
	'兑换失败。': 'redeemFailed',
	'创建失败': 'createFailed',
	'上传失败': 'uploadFailed',
	'复制失败': 'copyFailed',
	'领取失败': 'claimFailed',
	'钱包尚未就绪': 'walletNotReady',
	'请使用访问密码解锁钱包后继续。': 'unlockWalletToContinue',
	'请使用访问密码解锁钱包以领取优惠券。': 'unlockWalletToClaim',
	'兑换链接缺少有效的卡地址': 'redeemLinkMissingCard',
	'兑换链接无效或钱包未就绪': 'redeemLinkInvalid',
	'优惠券链接无效或钱包未就绪': 'couponLinkInvalid',
	'优惠券领取参数无效': 'couponClaimInvalid',
	'优惠券公开领取失败': 'claimFailed',
	'B-Unit 不足，无法完成此操作。': 'insufficientBUnits',
	'余额不足。': 'insufficientBalance',
	'签名者不是卡 admin。': 'signerNotCardAdmin',
}

function resolveErrorKey(raw: string): ErrorKey | null {
	const trimmed = raw.trim()
	if (!trimmed) return null

	const exact = EXACT_EN_TO_KEY[trimmed]
	if (exact) return exact

	const zhKey = ZH_TO_KEY[trimmed]
	if (zhKey) return zhKey

	for (const { test, key } of ERROR_PATTERNS) {
		if (test.test(trimmed)) return key
	}
	return null
}

/**
 * Map server / catch error strings to localized copy via i18n `errors.*`.
 * Unknown messages are returned as-is (trimmed).
 */
export function mapServerError(raw: unknown, fallbackKey: ErrorKey = 'generic'): string {
	if (raw == null) return t(`errors.${fallbackKey}`)
	const text = String(raw).trim()
	if (!text) return t(`errors.${fallbackKey}`)

	const key = resolveErrorKey(text)
	if (key) return t(`errors.${key}`)

	return text
}

export function mapServerErrorOrFallback(
	raw: unknown,
	fallbackKey: ErrorKey = 'generic',
): string {
	const mapped = mapServerError(raw, fallbackKey)
	if (mapped === String(raw).trim()) {
		return t(`errors.${fallbackKey}`)
	}
	return mapped
}
