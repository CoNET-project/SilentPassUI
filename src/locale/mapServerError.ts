import en from './en.json'
import { t } from './i18n'

type ErrorKey = keyof typeof en.errors

const EXACT_EN_TO_KEY: Record<string, ErrorKey> = {}
for (const [key, value] of Object.entries(en.errors)) {
	if (typeof value === 'string' && value.trim()) {
		EXACT_EN_TO_KEY[value.trim()] = key as ErrorKey
	}
}

const ERROR_PATTERNS: Array<{ test: RegExp; key: ErrorKey }> = [
	{ test: /signer is not card admin/i, key: 'signerNotCardAdmin' },
	{ test: /insufficient b-?units?/i, key: 'insufficientBUnits' },
	{ test: /insufficient balance/i, key: 'insufficientBalance' },
	{ test: /network error|failed to fetch|network request failed/i, key: 'network' },
	{ test: /oracle rate unavailable/i, key: 'oracleUnavailable' },
	{ test: /wallet is not ready/i, key: 'walletNotReady' },
	{ test: /unlock your wallet with your access password/i, key: 'unlockWalletToContinue' },
	{ test: /search failed/i, key: 'searchFailed' },
	{ test: /login failed/i, key: 'loginFailed' },
	{ test: /invalid beamio tag/i, key: 'invalidBeamioTag' },
	{ test: /request failed/i, key: 'requestFailed' },
	{ test: /sign failed/i, key: 'signFailed' },
	{ test: /create failed/i, key: 'createFailed' },
	{ test: /upload failed/i, key: 'uploadFailed' },
	{ test: /copy failed/i, key: 'copyFailed' },
]

const ZH_TO_KEY: Record<string, ErrorKey> = {
	'请求失败。': 'requestFailed',
	'签名失败。': 'signFailed',
	'创建失败': 'createFailed',
	'上传失败': 'uploadFailed',
	'复制失败': 'copyFailed',
	'钱包尚未就绪': 'walletNotReady',
	'请使用访问密码解锁钱包后继续。': 'unlockWalletToContinue',
	'搜索失败，请重试。': 'searchFailed',
	'登录失败，请稍后重试。': 'loginFailed',
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

export function mapServerError(raw: unknown, fallbackKey: ErrorKey = 'generic'): string {
	if (raw == null) return t(`errors.${fallbackKey}`)
	const text = String(raw).trim()
	if (!text) return t(`errors.${fallbackKey}`)
	const key = resolveErrorKey(text)
	if (key) return t(`errors.${key}`)
	return text
}
