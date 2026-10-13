/**
 * Session-only Access Password for the agent EOA (tab memory).
 * Needed after createRecover overwrites IndexedDB with a temp wallet —
 * we restore the agent with this password without re-prompting.
 */

let agentAccessPassword: string | null = null

export function setSessionAgentAccessPassword(password: string | null | undefined): void {
	const p = typeof password === 'string' ? password.trim() : ''
	agentAccessPassword = p.length > 0 ? p : null
}

export function getSessionAgentAccessPassword(): string | null {
	return agentAccessPassword
}

export function wipeSessionAgentAccessPassword(): void {
	agentAccessPassword = null
}
