/** 本地保存的 ValidatorDepositRedeem 兑换码（明文 code 仅存本机 localStorage）。 */
export type StoredValidatorRedeemCode = {
	id: string
	code: string
	codeHash: string
	allowedClaimer: string
	validatorCount: number
	targetNodeIp: string
	conetDepinNodeIps: string[]
	gbMiningNodeCount: number
	validAfter: number
	validBefore: number
	createdAt: string
	createTxHash?: string
	cancelledAt?: string
	cancelTxHash?: string
}

const STORAGE_PREFIX = 'validatorDepositRedeemCodes:v1:'

function storageKey(adminEoa: string): string {
	return `${STORAGE_PREFIX}${adminEoa.toLowerCase()}`
}

export function loadStoredValidatorRedeemCodes(adminEoa: string): StoredValidatorRedeemCode[] {
	try {
		const raw = localStorage.getItem(storageKey(adminEoa))
		if (!raw) return []
		const parsed = JSON.parse(raw) as StoredValidatorRedeemCode[]
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function saveStoredValidatorRedeemCodes(adminEoa: string, rows: StoredValidatorRedeemCode[]): void {
	localStorage.setItem(storageKey(adminEoa), JSON.stringify(rows))
}

export function appendStoredValidatorRedeemCode(adminEoa: string, row: StoredValidatorRedeemCode): void {
	const rows = loadStoredValidatorRedeemCodes(adminEoa)
	rows.unshift(row)
	saveStoredValidatorRedeemCodes(adminEoa, rows)
}

export function patchStoredValidatorRedeemCode(
	adminEoa: string,
	id: string,
	patch: Partial<StoredValidatorRedeemCode>
): void {
	const rows = loadStoredValidatorRedeemCodes(adminEoa).map((r) => (r.id === id ? { ...r, ...patch } : r))
	saveStoredValidatorRedeemCodes(adminEoa, rows)
}
