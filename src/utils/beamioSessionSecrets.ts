import { CoNET_Data, setCoNET_Data } from '@/utils/globals'

/** Session-only EOA signing material — bizSite only; never persisted (beamio-private-key-session-memory-only.mdc). */
let sessionPrivateKeyArmor: string | null = null

function ensureFlatProfiles(p: unknown): profile[] {
	if (!p || !Array.isArray(p)) return []
	if (p.length === 0) return []
	const first = (p as unknown[])[0]
	if (Array.isArray(first)) return (p as profile[][]).flat()
	return p as profile[]
}

export function setSessionPrivateKeyArmor(pk: string | null | undefined): void {
	const trimmed = pk?.trim()
	sessionPrivateKeyArmor = trimmed || null
}

export function getSessionPrivateKeyArmor(): string | null {
	return sessionPrivateKeyArmor
}

export function hasSessionPrivateKeyArmor(): boolean {
	return Boolean(sessionPrivateKeyArmor?.trim())
}

export function stripProfileSecrets(p: profile): profile {
	const { privateKeyArmor: _omit, ...rest } = p as profile & { privateKeyArmor?: string }
	return rest as profile
}

export function stripSecretsForPersistence(
	data: encrypt_keys_object | null | undefined,
): encrypt_keys_object | null {
	if (!data) return null
	const { mnemonicPhrase: _mnemonic, ...rest } = data as encrypt_keys_object & { mnemonicPhrase?: string }
	const temp = { ...rest } as encrypt_keys_object
	if (temp.profiles) {
		temp.profiles = ensureFlatProfiles(temp.profiles).map(stripProfileSecrets) as profile[]
	}
	return temp
}

/** Remove legacy on-disk secrets after load; signing material comes from session only. */
export function stripSecretsFromLoadedData(data: encrypt_keys_object): encrypt_keys_object {
	return stripSecretsForPersistence(data) as encrypt_keys_object
}

export function loadedDataHadPersistedSecrets(data: encrypt_keys_object): boolean {
	const flat = ensureFlatProfiles(data.profiles)
	if (flat.some((p) => Boolean((p as profile).privateKeyArmor?.trim()))) return true
	return Boolean((data as { mnemonicPhrase?: string }).mnemonicPhrase?.trim())
}

/** Attach session signing key to in-memory profiles (never written to PouchDB). */
export function hydrateProfilesWithSessionSecrets(profiles: profile[] | undefined): profile[] {
	const flat = ensureFlatProfiles(profiles)
	const pk = sessionPrivateKeyArmor?.trim()
	if (!pk) return flat.map(stripProfileSecrets)
	return flat.map((p, i) => (i === 0 ? { ...stripProfileSecrets(p), privateKeyArmor: pk } : stripProfileSecrets(p)))
}

export function syncCoNET_DataProfilesWithSession(): void {
	if (!CoNET_Data?.profiles) return
	setCoNET_Data({
		...CoNET_Data,
		profiles: hydrateProfilesWithSessionSecrets(CoNET_Data.profiles),
	})
}

/** Lock Wallet / logout: drop session key and strip from in-memory CoNET_Data. */
export function wipeSessionSecrets(): void {
	sessionPrivateKeyArmor = null
	if (CoNET_Data) {
		const stripped = stripSecretsForPersistence(CoNET_Data)
		if (stripped) setCoNET_Data(stripped)
	}
}

/** After restoreWithUserPin / createOrGetWallet: register key for this tab session. */
export function ingestSessionPrivateKeyFromProfiles(profiles: profile[] | undefined): boolean {
	const pk = ensureFlatProfiles(profiles)[0]?.privateKeyArmor?.trim()
	if (!pk) return false
	setSessionPrivateKeyArmor(pk)
	return true
}
