/**
 * Institutional Smart Wallet list UI prefs (EOA-partitioned).
 * Hidden rows collapse to a gray BeamioTag capsule until the user peeks or restores.
 */

import { ethers } from 'ethers'

const PREFIX = 'beamio:silentpass:eoa:'
const HIDDEN_SUFFIX = ':institutional-aa-list-hidden:v1'

type HiddenPayload = {
	v: 1
	eoa: string
	savedAt: number
	/** Checksummed AA addresses marked hidden (collapsed by default). */
	hiddenAa: string[]
}

function storageKey(eoaLower: string): string {
	return `${PREFIX}${eoaLower}${HIDDEN_SUFFIX}`
}

function normEoa(eoa: string): string {
	const t = eoa.trim()
	if (!t || !ethers.isAddress(t)) return ''
	return ethers.getAddress(t).toLowerCase()
}

function normAa(aa: string): string {
	const t = aa.trim()
	if (!t || !ethers.isAddress(t)) return ''
	return ethers.getAddress(t)
}

export function loadInstitutionalAaHiddenSet(eoa: string): Set<string> {
	const eoaLower = normEoa(eoa)
	if (!eoaLower) return new Set()
	try {
		const raw = localStorage.getItem(storageKey(eoaLower))
		if (!raw) return new Set()
		const parsed = JSON.parse(raw) as HiddenPayload
		if (parsed?.v !== 1 || !Array.isArray(parsed.hiddenAa)) return new Set()
		const out = new Set<string>()
		for (const a of parsed.hiddenAa) {
			const aa = normAa(String(a))
			if (aa) out.add(aa.toLowerCase())
		}
		return out
	} catch {
		return new Set()
	}
}

function persistHidden(eoa: string, hiddenLower: Set<string>): void {
	const eoaLower = normEoa(eoa)
	if (!eoaLower) return
	const hiddenAa = [...hiddenLower]
		.filter((a) => ethers.isAddress(a))
		.map((a) => ethers.getAddress(a))
	const payload: HiddenPayload = {
		v: 1,
		eoa: ethers.getAddress(eoaLower),
		savedAt: Date.now(),
		hiddenAa,
	}
	try {
		localStorage.setItem(storageKey(eoaLower), JSON.stringify(payload))
	} catch {
		/* ignore quota */
	}
}

export function isInstitutionalAaHidden(eoa: string, aaAccount: string): boolean {
	const aa = normAa(aaAccount)
	if (!aa) return false
	return loadInstitutionalAaHiddenSet(eoa).has(aa.toLowerCase())
}

export function setInstitutionalAaHidden(eoa: string, aaAccount: string, hidden: boolean): Set<string> {
	const aa = normAa(aaAccount)
	const next = loadInstitutionalAaHiddenSet(eoa)
	if (!aa) return next
	if (hidden) next.add(aa.toLowerCase())
	else next.delete(aa.toLowerCase())
	persistHidden(eoa, next)
	return next
}
