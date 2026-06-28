import { ethers } from 'ethers'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'

type ProfileLike = { keyID?: string | null; privateKeyArmor?: string | null } | null | undefined

/** Best-effort session EOA: DaemonContext profile → CoNET_Data → privateKeyArmor-derived wallet. */
export function resolveSessionEoa(profiles?: ProfileLike[] | null): string {
	const candidates: string[] = []
	const push = (raw?: string | null) => {
		const t = raw?.trim()
		if (t && ethers.isAddress(t)) candidates.push(ethers.getAddress(t))
	}

	push(profiles?.[0]?.keyID)
	push(CoNET_Data?.profiles?.[0]?.keyID)

	const armor = resolveSigningPrivateKeyArmor(profiles?.[0] ?? CoNET_Data?.profiles?.[0])
	if (armor) {
		try {
			candidates.push(new ethers.Wallet(armor).address)
		} catch {
			/* ignore invalid armor */
		}
	}

	return candidates[0] ?? ''
}
