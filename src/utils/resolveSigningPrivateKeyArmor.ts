import { ensureProfilePrivateKeyArmorFromMnemonic } from '@/services/beamio'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'

type ProfileWithKey = { privateKeyArmor?: string | null } | null | undefined

/**
 * Signing material for open-claim / EIP-712 flows.
 * Prefer in-memory profile; then `CoNET_Data` (IndexedDB + mnemonic hydrate).
 * Consumer apps may persist `privateKeyArmor` locally — see `beamio-consumer-wallet-signing-storage.mdc`.
 */
export function resolveSigningPrivateKeyArmor(profile?: ProfileWithKey): string {
	const fromProfile = profile?.privateKeyArmor?.trim() ?? ''
	if (fromProfile) return fromProfile
	const hydrated = ensureProfilePrivateKeyArmorFromMnemonic(CoNET_Data)
	if (hydrated && hydrated !== CoNET_Data) {
		setCoNET_Data(hydrated)
	}
	return hydrated?.profiles?.[0]?.privateKeyArmor?.trim() ?? ''
}
