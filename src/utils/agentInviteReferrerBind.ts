import { ethers } from 'ethers'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { CoNET_Data } from '@/utils/globals'
import {
	clearAgentInviteIntroducer,
	readAgentInviteIntroducer,
	stashAgentInviteIntroducerFromCurrentUrl,
} from '@/utils/agentInviteIntroducerStash'
import { registerReferrerUnderIntroducer } from '@/utils/agentReferrerRegistryClient'

const SESSION_BIND_KEY_PREFIX = 'beamio:agent-invite-referrer-bind:v1:'
const bindInFlight = new Map<string, Promise<void>>()

function sessionBindKey(introducer: string, referee: string): string {
	return `${SESSION_BIND_KEY_PREFIX}${introducer.toLowerCase()}:${referee.toLowerCase()}`
}

function wasBoundThisSession(introducer: string, referee: string): boolean {
	try {
		return sessionStorage.getItem(sessionBindKey(introducer, referee)) === '1'
	} catch {
		return false
	}
}

function markBoundThisSession(introducer: string, referee: string): void {
	try {
		sessionStorage.setItem(sessionBindKey(introducer, referee), '1')
	} catch {
		/* ignore */
	}
}

/**
 * After wallet is ready: stash `invite=` if present, then offline-sign RegisterReferrer.
 * Best-effort; failures keep stash for retry (except permanent self-introducer).
 */
export async function bindStashedAgentInviteReferrerIfNeeded(
	refereeEoa?: string | null,
): Promise<void> {
	stashAgentInviteIntroducerFromCurrentUrl()
	const introducer = readAgentInviteIntroducer()
	if (!introducer) return

	const refereeRaw =
		refereeEoa?.trim() ||
		CoNET_Data?.profiles?.[0]?.keyID?.trim() ||
		''
	if (!refereeRaw || !ethers.isAddress(refereeRaw)) return
	const referee = ethers.getAddress(refereeRaw)

	if (introducer.toLowerCase() === referee.toLowerCase()) {
		clearAgentInviteIntroducer()
		return
	}

	const dedupe = sessionBindKey(introducer, referee)
	if (wasBoundThisSession(introducer, referee)) {
		clearAgentInviteIntroducer()
		return
	}
	const existing = bindInFlight.get(dedupe)
	if (existing) {
		await existing
		return
	}

	const work = (async () => {
		const pk = resolveSigningPrivateKeyArmor(CoNET_Data?.profiles?.[0])
		if (!pk) return
		const result = await registerReferrerUnderIntroducer(introducer, pk, referee)
		if (result.success) {
			markBoundThisSession(introducer, referee)
			clearAgentInviteIntroducer()
			return
		}
		const err = (result.error || '').toLowerCase()
		if (
			err.includes('already') ||
			err.includes('introducer_set') ||
			err.includes('already registered')
		) {
			markBoundThisSession(introducer, referee)
			clearAgentInviteIntroducer()
		}
	})()

	bindInFlight.set(dedupe, work)
	try {
		await work
	} finally {
		bindInFlight.delete(dedupe)
	}
}
