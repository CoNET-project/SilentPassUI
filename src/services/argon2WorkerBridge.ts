/**
 * Main-thread bridge for Argon2id Worker.
 * Falls back to sync `@noble/hashes` on the main thread if the Worker cannot start.
 */

import { argon2id } from '@noble/hashes/argon2.js'
import type { Argon2idWorkerRequest, Argon2idWorkerResponse } from '@/workers/argon2/protocol'

export type Argon2idOpts = {
	m: number
	t: number
	p: number
	dkLen: number
}

type Pending = {
	resolve: (hash: Uint8Array) => void
	reject: (e: Error) => void
}

let worker: Worker | null = null
let workerFailed = false
let nextReqId = 1
const pending = new Map<number, Pending>()

function runSync(
	password: Uint8Array,
	salt: Uint8Array,
	opts: Argon2idOpts,
): Uint8Array {
	return Uint8Array.from(
		argon2id(password, salt, {
			m: opts.m,
			t: opts.t,
			p: opts.p,
			dkLen: opts.dkLen,
		}),
	)
}

function ensureWorker(): Worker | null {
	if (workerFailed) return null
	if (worker) return worker
	try {
		worker = new Worker(new URL('../workers/argon2/entry.ts', import.meta.url), {
			type: 'module',
		})
		worker.onmessage = (ev: MessageEvent<Argon2idWorkerResponse>) => {
			const msg = ev.data
			if (!msg || typeof msg !== 'object') return
			if (msg.type === 'ready') return
			if (msg.type !== 'argon2id-result') return
			const p = pending.get(msg.reqId)
			if (!p) return
			pending.delete(msg.reqId)
			if (msg.ok) p.resolve(new Uint8Array(msg.hash))
			else p.reject(new Error(msg.error || 'argon2id_failed'))
		}
		worker.onerror = (err) => {
			console.warn('[argon2Worker] error — falling back to main thread', err.message)
			workerFailed = true
			for (const [, p] of pending) {
				p.reject(new Error(err.message || 'argon2_worker_error'))
			}
			pending.clear()
			try {
				worker?.terminate()
			} catch {
				/* ignore */
			}
			worker = null
		}
		return worker
	} catch (err) {
		console.warn('[argon2Worker] unavailable — using main-thread argon2id', err)
		workerFailed = true
		worker = null
		return null
	}
}

/** Kick off Worker parse early (Create ID form mount) so first hash is warm. */
export function warmArgon2Worker(): void {
	ensureWorker()
}

/**
 * Argon2id hash off the main thread when possible.
 * Copies inputs so the caller's buffers stay intact if we transfer.
 */
export async function argon2idAsync(
	password: Uint8Array,
	salt: Uint8Array,
	opts: Argon2idOpts,
): Promise<Uint8Array> {
	const w = ensureWorker()
	if (!w) {
		return runSync(password, salt, opts)
	}

	const reqId = nextReqId++
	const passwordCopy = password.slice()
	const saltCopy = salt.slice()

	return new Promise<Uint8Array>((resolve, reject) => {
		pending.set(reqId, { resolve, reject })
		const payload: Argon2idWorkerRequest = {
			type: 'argon2id',
			reqId,
			password: passwordCopy.buffer,
			salt: saltCopy.buffer,
			m: opts.m,
			t: opts.t,
			p: opts.p,
			dkLen: opts.dkLen,
		}
		try {
			w.postMessage(payload, [passwordCopy.buffer, saltCopy.buffer])
		} catch (err) {
			pending.delete(reqId)
			reject(err instanceof Error ? err : new Error(String(err)))
		}
	}).catch((err) => {
		// Worker died mid-request — one-shot main-thread fallback
		console.warn('[argon2Worker] request failed, sync fallback', err)
		return runSync(password, salt, opts)
	})
}
