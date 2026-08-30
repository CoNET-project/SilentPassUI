/**
 * Off-main-thread Argon2id — keeps UI animations (Create ID loading) responsive
 * while hashing 32MB-memory params.
 */

import { argon2id } from '@noble/hashes/argon2.js'
import type { Argon2idWorkerRequest, Argon2idWorkerResponse } from './protocol'

// eslint-disable-next-line no-restricted-globals -- Worker entry (same pattern as appDaemon / beamioTag)
const ctx = self as unknown as {
	postMessage: (message: Argon2idWorkerResponse, transfer?: Transferable[]) => void
	onmessage: ((ev: MessageEvent<Argon2idWorkerRequest>) => void) | null
}

ctx.onmessage = (ev: MessageEvent<Argon2idWorkerRequest>) => {
	const msg = ev.data
	if (!msg || msg.type !== 'argon2id') return

	const { reqId, password, salt, m, t, p, dkLen } = msg
	try {
		const hash = argon2id(new Uint8Array(password), new Uint8Array(salt), {
			m,
			t,
			p,
			dkLen,
		})
		const out = Uint8Array.from(hash)
		const response: Argon2idWorkerResponse = {
			type: 'argon2id-result',
			reqId,
			ok: true,
			hash: out.buffer,
		}
		ctx.postMessage(response, [out.buffer])
	} catch (err: unknown) {
		const response: Argon2idWorkerResponse = {
			type: 'argon2id-result',
			reqId,
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		}
		ctx.postMessage(response)
	}
}

ctx.postMessage({ type: 'ready' } satisfies Argon2idWorkerResponse)
