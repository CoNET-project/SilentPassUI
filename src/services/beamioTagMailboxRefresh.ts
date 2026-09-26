/**
 * Global BeamioTag mailbox mirror.
 * Local record first. Network supplements tag/image/names, listen online, and
 * native-shell wakeability when that field is older than 180 seconds.
 * Queries are encrypted to mailbox B and posted only through an entry C ≠ B.
 * An open chat thread claims online and refreshes that one wallet every 6 seconds.
 */

import { ethers } from 'ethers'
import { refreshChatMailboxPresence, refreshPeerNativeWakeable } from '@/services/chat'
import {
	getBeamioTagMirrorMap,
	mergeBeamioTagTrusted,
	searchBeamioTagRemote,
} from '@/services/beamioTagWorkerBridge'
import type { BeamioAddressProfileRecord } from '@/utils/beamioAddressProfileRegistry'

export const BEAMIO_TAG_RECORD_FRESH_MS = 180_000

const MAX_PER_TICK = 28
const chatOwnedOnline = new Set<string>()

export function claimChatOnlineQuery(address: string): void {
	const key = address.trim().toLowerCase()
	if (key) chatOwnedOnline.add(key)
}

export function releaseChatOnlineQuery(address: string): void {
	chatOwnedOnline.delete(address.trim().toLowerCase())
}

function addrKey(address: string): string | null {
	const t = address.trim()
	if (!t || !ethers.isAddress(t)) return null
	try {
		return ethers.getAddress(t).toLowerCase()
	} catch {
		return null
	}
}

async function writeRecord(
	addressLower: string,
	patch: Partial<BeamioAddressProfileRecord>,
): Promise<void> {
	const prev = getBeamioTagMirrorMap()[addressLower]
	const next: BeamioAddressProfileRecord = {
		addressLower,
		updatedAt: prev?.updatedAt || Date.now(),
		...prev,
		...patch,
		addressLower,
		updatedAt: patch.updatedAt ?? prev?.updatedAt ?? Date.now(),
	}
	await mergeBeamioTagTrusted({ [addressLower]: next })
}

export async function rememberPeerOnline(address: string, online: boolean): Promise<void> {
	const key = addrKey(address)
	if (!key) return
	await writeRecord(key, { online, onlineAt: Date.now() })
}

export async function rememberPeerNativeWakeable(
	address: string,
	nativeWakeable: boolean,
): Promise<void> {
	const key = addrKey(address)
	if (!key) return
	await writeRecord(key, { nativeWakeable, nativeWakeAt: Date.now() })
}

type ChatRow = {
	address?: string
	chatData?: { routersArmoreds?: string }
}

type ProfileSnap = {
	privateKeyArmor?: string
	chats?: ChatRow[]
}

export function startBeamioTagMailboxRefresh(
	getProfile: () => ProfileSnap | undefined,
): () => void {
	let stopped = false
	let timer: ReturnType<typeof setTimeout> | undefined
	let cursor = 0
	let running = false

	const schedule = (delay: number) => {
		if (stopped) return
		timer = setTimeout(() => {
			void tick()
		}, delay)
	}

	const tick = async () => {
		if (stopped) return
		if (running) {
			schedule(BEAMIO_TAG_RECORD_FRESH_MS)
			return
		}
		running = true
		try {
			const profile = getProfile()
			const key = (profile?.privateKeyArmor || '').trim()
			const chats = Array.isArray(profile?.chats) ? profile.chats : []
			const now = Date.now()
			const batch = chats.slice(cursor, cursor + MAX_PER_TICK)
			cursor = cursor + MAX_PER_TICK >= chats.length ? 0 : cursor + MAX_PER_TICK
			for (const chat of batch) {
				if (stopped) return
				const addr = addrKey(chat.address || '')
				const route = chat.chatData?.routersArmoreds?.trim() || ''
				if (!addr) continue
				const rec = getBeamioTagMirrorMap()[addr]
				if (!rec?.updatedAt || now - rec.updatedAt > BEAMIO_TAG_RECORD_FRESH_MS) {
					try {
						await searchBeamioTagRemote(ethers.getAddress(addr))
					} catch {
						/* keep the last tag and image */
					}
				}
				if (!key || !route) continue
				const fresh = getBeamioTagMirrorMap()[addr]
				if (
					!chatOwnedOnline.has(addr) &&
					(!fresh?.onlineAt || now - fresh.onlineAt > BEAMIO_TAG_RECORD_FRESH_MS)
				) {
					const onlineByAddr = await refreshChatMailboxPresence(
						[{ address: addr, chatData: { routersArmoreds: route } } as never],
						key,
					)
					if (onlineByAddr.has(addr)) {
						await rememberPeerOnline(addr, !!onlineByAddr.get(addr))
					}
				}
				const afterOnline = getBeamioTagMirrorMap()[addr]
				if (!afterOnline?.nativeWakeAt || now - afterOnline.nativeWakeAt > BEAMIO_TAG_RECORD_FRESH_MS) {
					const wake = await refreshPeerNativeWakeable(addr, route, key)
					if (wake?.ok) await rememberPeerNativeWakeable(addr, wake.nativeWakeable)
				}
			}
		} finally {
			running = false
			schedule(BEAMIO_TAG_RECORD_FRESH_MS)
		}
	}

	void tick()
	return () => {
		stopped = true
		if (timer !== undefined) clearTimeout(timer)
	}
}
