/**
 * Settings / myWallet 页：本地优先 + semi-permanent（localStorage，按 EOA 隔离）。
 * API 失败时不覆盖已展示的缓存值。
 */

import { ethers } from 'ethers'

const FOLLOW_PREFIX = 'beamio:settingsFollowCounts:v1:'
const CURRENCY_PREFIX = 'beamio:settingsCurrencyLabel:v1:'

type FollowPayload = {
	v: 1
	eoa: string
	followingCount: number
	followerCount: number
	savedAt: number
}

type CurrencyPayload = {
	v: 1
	eoa: string
	currencyLabel: string
	savedAt: number
}

function followKey(eoaLower: string): string {
	return `${FOLLOW_PREFIX}${eoaLower}`
}

function currencyKey(eoaLower: string): string {
	return `${CURRENCY_PREFIX}${eoaLower}`
}

export function loadSettingsFollowCounts(
	eoaLower: string
): { followingCount: number; followerCount: number } | null {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return null
	try {
		const raw = localStorage.getItem(followKey(eoaLower.toLowerCase()))
		if (!raw) return null
		const p = JSON.parse(raw) as FollowPayload
		if (
			p?.v !== 1 ||
			typeof p.followingCount !== 'number' ||
			typeof p.followerCount !== 'number' ||
			typeof p.eoa !== 'string'
		) {
			return null
		}
		if (p.eoa.toLowerCase() !== eoaLower.toLowerCase()) return null
		return { followingCount: p.followingCount, followerCount: p.followerCount }
	} catch {
		return null
	}
}

export function saveSettingsFollowCounts(
	eoaLower: string,
	followingCount: number,
	followerCount: number
): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	try {
		const payload: FollowPayload = {
			v: 1,
			eoa: eoaLower.toLowerCase(),
			followingCount,
			followerCount,
			savedAt: Date.now(),
		}
		localStorage.setItem(followKey(eoaLower.toLowerCase()), JSON.stringify(payload))
	} catch {
		/* quota / private mode */
	}
}

export function loadSettingsCurrencyLabel(eoaLower: string): string | null {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return null
	try {
		const raw = localStorage.getItem(currencyKey(eoaLower.toLowerCase()))
		if (!raw) return null
		const p = JSON.parse(raw) as CurrencyPayload
		if (p?.v !== 1 || typeof p.currencyLabel !== 'string' || typeof p.eoa !== 'string') return null
		if (p.eoa.toLowerCase() !== eoaLower.toLowerCase()) return null
		const t = p.currencyLabel.trim()
		return t || null
	} catch {
		return null
	}
}

export function saveSettingsCurrencyLabel(eoaLower: string, currencyLabel: string): void {
	if (typeof window === 'undefined' || !eoaLower || !ethers.isAddress(eoaLower)) return
	const t = currencyLabel.trim()
	if (!t) return
	try {
		const payload: CurrencyPayload = {
			v: 1,
			eoa: eoaLower.toLowerCase(),
			currencyLabel: t,
			savedAt: Date.now(),
		}
		localStorage.setItem(currencyKey(eoaLower.toLowerCase()), JSON.stringify(payload))
	} catch {
		/* quota */
	}
}
