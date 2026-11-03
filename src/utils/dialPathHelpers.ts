/**
 * Dial path helpers (pure, no crypto imports, so Jest can load them).
 *
 * RC3d R17: inside the shell, the chat page re-rendered for the dial's state
 * updates during the 0.6 s before the native call screen covers it. That render
 * held back the offer's last encryption (1.3–3.8 s instead of milliseconds), so
 * 18 of 20 dials showed the screen on the 0.6 s timeout instead of on the offer.
 */

/**
 * Applies the dial's page state once. In a browser it applies at once (the page
 * is the call screen). Inside the shell it waits until the offer is handed to the
 * native side (`offerHanded`), or until the dial settles (`settle`): the native
 * screen already shows the call, so the page state can come a moment later.
 */
export function createDialStateGate(apply: () => void, deferUntilOfferHanded: boolean) {
	let applied = false
	const run = () => {
		if (applied) return
		applied = true
		apply()
	}
	if (!deferUntilOfferHanded) run()
	return {
		offerHanded: run,
		settle: run,
		get applied() {
			return applied
		},
	}
}

const normalizeArmor = (v?: string) => (v || '').replace(/\r/g, '').trim()

/**
 * IPs of the nodes whose route key is one of `routes` (the two mailboxes): the
 * offer's entry must be neither. Each armor is normalised once.
 */
export function mailboxNodeIps(
	nodes: Array<{ armoredPublicKey?: string; ip_addr?: string }>,
	routes: Array<string | undefined>,
): string[] {
	const keys = new Set(routes.map(normalizeArmor).filter(Boolean))
	if (!keys.size) return []
	const out: string[] = []
	for (const n of nodes) {
		if (!keys.has(normalizeArmor(n.armoredPublicKey))) continue
		const ip = String(n.ip_addr || '').trim()
		if (ip) out.push(ip)
	}
	return out
}
