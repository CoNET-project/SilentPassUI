import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'

/** Fired after consumer wallet recovers / unlocks so AppShell can start gossip. */
export const BEAMIO_WALLET_READY_EVENT = 'beamio:wallet-ready'

export function dispatchBeamioWalletReady(reason: string): void {
	if (typeof window === 'undefined') return
	publishNativePwaLog('info', `[Wallet] ready — ${reason}`)
	window.dispatchEvent(new CustomEvent(BEAMIO_WALLET_READY_EVENT, { detail: { reason } }))
}
