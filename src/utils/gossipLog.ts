/**
 * Gossip / chat-listen diagnostics that survive production Terser `drop_console`.
 * `craco.config.js` strips `console.*` CallExpressions; bracket + apply does not.
 */
export type GossipLogLevel = 'info' | 'warn' | 'error'

export function gossipLog(level: GossipLogLevel, ...args: unknown[]): void {
	const c = (globalThis as { console?: Console }).console
	if (!c) return
	const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
	const fn = (c as unknown as Record<string, unknown>)[method]
	if (typeof fn === 'function') {
		;(fn as (...a: unknown[]) => void).apply(c, ['[Gossip]', ...args])
	}
}
