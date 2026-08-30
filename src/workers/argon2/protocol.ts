/** Argon2id worker request / response shapes (main ↔ worker). */

export type Argon2idWorkerRequest = {
	type: 'argon2id'
	reqId: number
	/** UTF-8 password bytes */
	password: ArrayBuffer
	salt: ArrayBuffer
	m: number
	t: number
	p: number
	dkLen: number
}

export type Argon2idWorkerResponse =
	| {
			type: 'argon2id-result'
			reqId: number
			ok: true
			hash: ArrayBuffer
	  }
	| {
			type: 'argon2id-result'
			reqId: number
			ok: false
			error: string
	  }
	| { type: 'ready' }
