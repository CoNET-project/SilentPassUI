/**
 * Host store for CoNET Chat group V1.
 * Signing and per-recipient encryption stay in the chat SDK worker.
 * This module only applies verified objects and keeps the local group view.
 */
import {
	GroupStateV1,
	assertGroupAdminProposalV1,
	type ChatRoute,
	type GroupAdminProposalV1,
	type GroupInboundEvent,
	type GroupMessageV1,
	type GroupRosterV1,
	type GroupTombstoneV1,
} from '@conet.project/chat-sdk'

import {
	issueWorkerGroupRoster,
	issueWorkerGroupTombstone,
	onGroupInbound,
	sendWorkerGroupMessage,
} from '@/services/chatWorkerBridge'

export interface StoredGroupV1 {
	roster: GroupRosterV1
	tombstone: GroupTombstoneV1 | null
	messages: GroupMessageV1[]
	proposals: GroupAdminProposalV1[]
	nextSeq: number
}

type Listener = () => void

const DB_NAME = 'beamio-group-chat-v1'
const STORE = 'groups'
const listeners = new Set<Listener>()
const states = new Map<string, GroupStateV1>()
const pendingMessages = new Map<string, GroupMessageV1[]>()
let ownerEoa = ''
let groups: Record<string, StoredGroupV1> = {}
let inboundAttached = false

function notify(): void {
	for (const cb of listeners) {
		try { cb() } catch { /* isolate */ }
	}
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

async function persist(): Promise<void> {
	if (!ownerEoa) return
	const db = await openDb()
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).put({ v: 1, groups }, ownerEoa)
		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}

function rebuildState(record: StoredGroupV1): GroupStateV1 {
	const state = new GroupStateV1()
	state.applyRoster(record.roster)
	if (record.tombstone) state.applyTombstone(record.tombstone)
	for (const message of record.messages) {
		try { state.acceptMessage(message) } catch { /* already stored; keep the transcript */ }
	}
	return state
}

function flushPending(groupId: string): void {
	const queued = pendingMessages.get(groupId) ?? []
	if (!queued.length) return
	pendingMessages.set(groupId, [])
	for (const message of queued) acceptMessage(message)
}

function acceptMessage(message: GroupMessageV1): void {
	const record = groups[message.groupId]
	const state = states.get(message.groupId)
	if (!record || !state) {
		const queued = pendingMessages.get(message.groupId) ?? []
		if (!queued.some((item) => item.sendId === message.sendId)) queued.push(message)
		pendingMessages.set(message.groupId, queued)
		return
	}
	if (record.messages.some((item) => item.sendId === message.sendId && item.seq === message.seq)) return
	state.acceptMessage(message)
	record.messages = [...record.messages, message].sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
	record.nextSeq = Math.max(record.nextSeq, message.seq + 1)
}

function applyInbound(event: GroupInboundEvent): void {
	if (event.kind === 'roster' && event.roster) {
		const next = event.roster
		const current = groups[next.groupId]
		if (current?.tombstone) return
		const state = current ? states.get(next.groupId) ?? rebuildState(current) : new GroupStateV1()
		state.applyRoster(next)
		states.set(next.groupId, state)
		groups = {
			...groups,
			[next.groupId]: {
				roster: next,
				tombstone: null,
				messages: current?.messages ?? [],
				proposals: current?.proposals ?? [],
				nextSeq: current?.nextSeq ?? 0,
			},
		}
		flushPending(next.groupId)
		void persist()
		notify()
		return
	}
	if (event.kind === 'message' && event.message) {
		acceptMessage(event.message)
		void persist()
		notify()
		return
	}
	if (event.kind === 'tombstone' && event.tombstone) {
		const record = groups[event.tombstone.groupId]
		const state = states.get(event.tombstone.groupId)
		if (!record || !state) return
		state.applyTombstone(event.tombstone)
		groups = {
			...groups,
			[record.roster.groupId]: { ...record, tombstone: event.tombstone },
		}
		void persist()
		notify()
		return
	}
	if (event.kind === 'proposal' && event.proposal) {
		const proposal = event.proposal
		const record = groups[proposal.groupId]
		if (!record || record.tombstone) return
		try { assertGroupAdminProposalV1(proposal, record.roster) } catch { return }
		if (record.proposals.some((item) => item.proposalId === proposal.proposalId)) return
		groups = {
			...groups,
			[proposal.groupId]: { ...record, proposals: [...record.proposals, proposal] },
		}
		void persist()
		notify()
	}
}

export function startGroupChatInbound(): () => void {
	if (!inboundAttached) {
		inboundAttached = true
		onGroupInbound(applyInbound)
	}
	return () => { /* listeners stay for the process lifetime */ }
}

export async function loadGroupChats(eoa: string): Promise<void> {
	ownerEoa = eoa.trim().toLowerCase()
	groups = {}
	states.clear()
	if (!ownerEoa) {
		notify()
		return
	}
	try {
		const db = await openDb()
		const stored = await new Promise<{ groups?: Record<string, StoredGroupV1> } | undefined>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly')
			const req = tx.objectStore(STORE).get(ownerEoa)
			req.onsuccess = () => resolve(req.result as { groups?: Record<string, StoredGroupV1> } | undefined)
			req.onerror = () => reject(req.error)
		})
		groups = stored?.groups ?? {}
		for (const [id, record] of Object.entries(groups)) {
			try { states.set(id, rebuildState(record)) } catch { /* keep the stored transcript */ }
		}
	} catch {
		groups = {}
	}
	notify()
}

export function listGroupChats(): StoredGroupV1[] {
	return Object.values(groups).sort((a, b) => b.roster.issuedAt - a.roster.issuedAt)
}

export function subscribeGroupChats(cb: Listener): () => void {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

export async function createGroupChat(input: {
	name: string
	memberEoas: string[]
	routes: ChatRoute[]
}): Promise<{ acceptedRecipients: number; failedRecipients: number }> {
	const name = input.name.trim()
	if (!name) throw new Error('Enter a group name')
	const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
	const result = await issueWorkerGroupRoster({
		name,
		memberEoas: input.memberEoas,
		routes: input.routes,
		expiresAt,
	})
	applyInbound({
		kind: 'roster',
		recoveredFrom: result.roster.signer,
		receivedAt: Date.now(),
		roster: result.roster,
	})
	return { acceptedRecipients: result.acceptedRecipients, failedRecipients: result.failedRecipients }
}

export async function sendGroupChatMessage(
	groupId: string,
	body: string,
	routes: ChatRoute[],
): Promise<{ acceptedRecipients: number; failedRecipients: number }> {
	const text = body.trim()
	if (!text) throw new Error('Enter a message')
	const record = groups[groupId]
	const state = states.get(groupId)
	if (!record || !state?.activeRoster) throw new Error('This group is closed')
	const seq = record.nextSeq
	const result = await sendWorkerGroupMessage({
		roster: record.roster,
		body: text,
		seq,
		expiresAt: Date.now() + 60 * 60 * 1000,
		routes,
	})
	acceptMessage(result.message)
	void persist()
	notify()
	return { acceptedRecipients: result.acceptedRecipients, failedRecipients: result.failedRecipients }
}

export async function endGroupChat(
	groupId: string,
	routes: ChatRoute[],
): Promise<{ acceptedRecipients: number; failedRecipients: number }> {
	const record = groups[groupId]
	if (!record || record.tombstone) throw new Error('This group is already closed')
	const result = await issueWorkerGroupTombstone({ roster: record.roster, routes })
	applyInbound({
		kind: 'tombstone',
		recoveredFrom: result.tombstone.signer,
		receivedAt: Date.now(),
		tombstone: result.tombstone,
	})
	return { acceptedRecipients: result.acceptedRecipients, failedRecipients: result.failedRecipients }
}
