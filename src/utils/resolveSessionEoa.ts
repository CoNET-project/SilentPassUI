import { ethers } from 'ethers'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'

type ProfileLike = { keyID?: string | null; privateKeyArmor?: string | null } | null | undefined

/**
 * Session EOA for signing / admin probes.
 * When a signing key is available, its wallet address wins over profile keyID so EIP-712
 * `admin` matches the actual signer (avoids API "Signer is not admin" on keyID drift).
 */
export function resolveSessionEoa(profiles?: ProfileLike[] | null): string {
	const profile = profiles?.[0] ?? CoNET_Data?.profiles?.[0]
	const armor = resolveSigningPrivateKeyArmor(profile)
	if (armor) {
		try {
			return new ethers.Wallet(armor).address
		} catch {
			/* fall through to keyID */
		}
	}

	const candidates: string[] = []
	const push = (raw?: string | null) => {
		const t = raw?.trim()
		if (t && ethers.isAddress(t)) candidates.push(ethers.getAddress(t))
	}
	push(profiles?.[0]?.keyID)
	push(CoNET_Data?.profiles?.[0]?.keyID)
	return candidates[0] ?? ''
}
