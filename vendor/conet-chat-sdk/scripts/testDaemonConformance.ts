/**
 * ChatDaemon protocol v1 conformance (TS Worker side). Reads the shared vectors
 * spec/chat-daemon-vectors.v1.json — the same file chat-sdk-ios and
 * chat-sdk-android test against — and runs them on the built package (dist/).
 *
 *   npm run test:conformance
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decrypt, readMessage, readPrivateKey } from 'openpgp'
import { ethers } from 'ethers'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = await import(join(root, 'dist', 'index.js'))
const vectors = JSON.parse(readFileSync(join(root, 'spec', 'chat-daemon-vectors.v1.json'), 'utf8'))
const schema = JSON.parse(readFileSync(join(root, 'spec', 'chat-daemon-protocol.v1.schema.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let passed = 0
async function check(name: string, fn: () => unknown | Promise<unknown>): Promise<void> {
	try {
		await fn()
		passed++
	} catch (err) {
		console.error(`FAIL ${name}`)
		throw err
	}
}

const keys = vectors.keys
const privateKeyFor = async (which: 'userPgp' | 'routePgp') =>
	readPrivateKey({ armoredKey: keys[which].privateArmored })
const decryptText = async (armor: string, which: 'userPgp' | 'routePgp'): Promise<string> => {
	const { data } = await decrypt({
		message: await readMessage({ armoredMessage: armor }),
		decryptionKeys: await privateKeyFor(which),
		format: 'utf8',
	})
	return String(data)
}
const decodeLiteral = (literal: string, encoding: 'base64-json' | 'json') =>
	JSON.parse(encoding === 'base64-json' ? Buffer.from(literal, 'base64').toString('utf8') : literal)
const sameAddress = (a: string, b: string) => assert.equal(a.toLowerCase(), b.toLowerCase())

// --- version + spec ---------------------------------------------------------
await check('protocol version', () => assert.equal(vectors.protocolVersion, sdk.CHAT_DAEMON_PROTOCOL_VERSION))
await check('capability list', () => assert.deepEqual(vectors.hello.capabilities, [...sdk.CHAT_DAEMON_CAPABILITIES]))
await check('sdk version = package.json', () => assert.equal(sdk.CHAT_SDK_VERSION, pkg.version))
await check('schema version', () => assert.equal(schema['x-protocolVersion'], sdk.CHAT_DAEMON_PROTOCOL_VERSION))
await check('every command has a privacy entry', () => {
	const refs: string[] = schema.definitions.ChatDaemonCommand.anyOf.map((r: { $ref: string }) => r.$ref.split('/').pop())
	const types = refs.map((name) => schema.definitions[name].properties.type.const as string)
	assert.deepEqual([...types].sort(), Object.keys(sdk.COMMAND_PRIVACY).sort())
	for (const name of refs) assert.ok(schema.definitions[name]['x-privacy'], `${name} has x-privacy`)
})

// --- signing ----------------------------------------------------------------
await check('test wallet', () => assert.equal(new ethers.Wallet(keys.wallet.privateKey).address, keys.wallet.address))
for (const v of vectors.eip191) {
	await check(`eip191 sign ${JSON.stringify(v.message).slice(0, 24)}`, async () => {
		assert.equal(await new ethers.Wallet(keys.wallet.privateKey).signMessage(v.message), v.signature)
	})
	await check(`eip191 recover ${JSON.stringify(v.message).slice(0, 24)}`, () =>
		sameAddress(ethers.verifyMessage(v.message, v.signature), v.signer),
	)
}

// --- envelopes --------------------------------------------------------------
for (const env of vectors.envelopes) {
	await check(`envelope ${env.name}`, async () => {
		const literal = await decryptText(env.armor, env.decryptWith)
		const obj = decodeLiteral(literal, env.literal)
		assert.deepEqual(obj, env.expect)
		assert.equal(ethers.keccak256(ethers.toUtf8Bytes(env.armor)), env.armorHash)
		if (env.signed) sameAddress(ethers.verifyMessage(obj[env.signed.textField], obj[env.signed.signatureField]), env.signed.signer)
		if (env.messageJson) assert.deepEqual(JSON.parse(obj.message), env.messageJson)
	})
}
// The SDK's own encoders produce the same structures.
const routeEnv = vectors.envelopes.find((e: { name: string }) => e.name === 'routeCommand')
const workEnv = vectors.envelopes.find((e: { name: string }) => e.name === 'mailboxWork')
await check('encryptRouteCommand round trip', async () => {
	const wallet = new ethers.Wallet(keys.wallet.privateKey)
	const armor = await sdk.encryptRouteCommand(wallet, routeEnv.messageJson, keys.routePgp.publicArmored)
	const obj = decodeLiteral(await decryptText(armor, 'routePgp'), 'base64-json')
	assert.deepEqual(Object.keys(obj).sort(), ['message', 'signMessage'])
	assert.deepEqual(JSON.parse(obj.message), routeEnv.messageJson)
	assert.equal(obj.signMessage, routeEnv.expect.signMessage)
})
await check('wrapArmorToMailboxWork round trip', async () => {
	const armor = await sdk.wrapArmorToMailboxWork(workEnv.expect.data, keys.routePgp.publicArmored, { NoPush: true })
	assert.deepEqual(JSON.parse(await decryptText(armor, 'routePgp')), workEnv.expect)
})

// --- ACK hash ---------------------------------------------------------------
for (const v of vectors.ackHash) {
	await check(`ack hash ${v.name}`, () => assert.equal(ethers.keccak256(ethers.toUtf8Bytes(v.armor)), v.armorHash))
}

// --- builders ---------------------------------------------------------------
const builders: Record<string, (i: Record<string, any>) => unknown> = {
	deliveryAckCommand: (i) => sdk.deliveryAckCommand(i.eoa, i.armorHash, i.timestamp),
	deliveryReceipt: (i) => sdk.deliveryReceipt(i.sendId, i.armorHash, i.deliveredAt, i.eoa),
	pendingRow: (i) => sdk.pendingRow(i.sendId, i.text, i.createdAt),
	chatEnvelope: (i) => sdk.chatEnvelope(i),
	mailboxWork: (i) => sdk.mailboxWork(i.data, i.noPush),
	mailboxWorkPush: (i) => sdk.mailboxWork(i.data, i.noPush),
}
for (const b of vectors.builders) {
	await check(`builder ${b.name}`, () => {
		const fn = builders[b.name]
		assert.ok(fn, `no TS builder for ${b.name}`)
		assert.deepEqual(fn(b.input), b.expect)
	})
}

await check('time units: receipt deliveredAt in ms, ack timestamp in seconds', () => {
	const receipt = vectors.builders.find((b: any) => b.name === 'deliveryReceipt')
	const ack = vectors.builders.find((b: any) => b.name === 'deliveryAckCommand')
	assert.ok(receipt.expect.deliveredAt >= 1e12, 'deliveredAt must be milliseconds')
	assert.ok(ack.expect.timestamp < 1e11, 'gossip_delivery_ack timestamp must be seconds')
})

// --- call signals -----------------------------------------------------------
for (const v of vectors.callSignal) {
	await check(`callSignal ${v.name}`, () => assert.deepEqual(sdk.classifyCallSignal(v.line), v.expect))
}
await check('call control = end/timeout only', () => {
	for (const v of vectors.callSignal) {
		const expect = v.expect && ['end', 'timeout'].includes(v.expect.kind) ? v.expect : null
		assert.deepEqual(sdk.parseCallControl(v.line), expect, v.name)
	}
})

// --- hello / negotiation ----------------------------------------------------
const expectTs = vectors.hello.implementations['ts-worker']
await check('ts-worker hello', () => {
	const h = sdk.tsWorkerHello()
	assert.equal(h.protocolVersion, expectTs.protocolVersion)
	assert.equal(h.minProtocolVersion, expectTs.minProtocolVersion)
	assert.equal(h.implementation, 'ts-worker')
	assert.equal(h.sdkVersion, pkg.version)
	assert.deepEqual(h.capabilities, expectTs.capabilities)
})
for (const v of vectors.hello.negotiation) {
	await check(`negotiate ${v.name}`, () => {
		const f = sdk.negotiateChatDaemon(v.reply)
		assert.deepEqual({ status: f.status, protocolVersion: f.protocolVersion, capabilities: f.capabilities }, v.expect)
	})
}

// Rule 19: the worker's send never uses the recipient's mailbox or our own mailbox as entry.
await check('send excludes both mailboxes from the entry pool', async () => {
	const { GossipCore } = await import(join(root, 'dist', 'worker', 'gossip-core.js'))
	const ownRoute = keys.routePgp.publicArmored
	const peerRoute = keys.userPgp.publicArmored // any distinct key works as "the peer's mailbox route"
	const node = (domain: string, armoredPublicKey = '') => ({ region: 'x', ip_addr: '10.0.0.1', armoredPublicKey, nftNumber: 0, domain })
	const nodes = [node('OWNMAILBOX', ownRoute), node('PEERMAILBOX', peerRoute), node('ENTRYA'), node('ENTRYB')]
	const posted: string[] = []
	const realFetch = globalThis.fetch
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		const domain = String(url).replace(/^https?:\/\//, '').split('.')[0]
		if (init?.method === 'POST') posted.push(domain)
		return new Response('ok', { status: 200 })
	}) as typeof fetch
	try {
		const noop = () => {}
		const core = new GossipCore({ message: noop, group: noop, voiceFrame: noop, voiceGap: noop, voiceConflict: noop, status: noop, log: noop, presence: noop })
		const c = core as unknown as Record<string, unknown>
		c.wallet = new ethers.Wallet(keys.wallet.privateKey)
		c.nodes = nodes
		c.cfg = { identity: { ownRouteArmoredPublicKey: ownRoute }, runtime: { sendFanout: 3, outerWrap: false, reconnectBaseMs: 4000, reconnectMaxMs: 30000 } }
		for (let i = 0; i < 5; i++) {
			const ok = await core.send({ address: '0x0000000000000000000000000000000000000001', userPublicKeyArmored: keys.userPgp.publicArmored, routerArmoredPublicKey: peerRoute }, `rule19 ${i}`)
			assert.equal(ok, true)
		}
	} finally {
		globalThis.fetch = realFetch
	}
	assert.ok(posted.length > 0, 'posted somewhere')
	assert.ok(!posted.includes('OWNMAILBOX'), `own mailbox used as entry: ${posted.join(',')}`)
	assert.ok(!posted.includes('PEERMAILBOX'), `peer mailbox used as entry: ${posted.join(',')}`)
	assert.deepEqual([...new Set(posted)].sort(), ['ENTRYA', 'ENTRYB'])
})
await check('mailboxDomainsFor', () => {
	const nodes = [
		{ domain: 'A', armoredPublicKey: keys.routePgp.publicArmored },
		{ domain: 'B', armoredPublicKey: keys.userPgp.publicArmored },
		{ domain: 'C', armoredPublicKey: '' },
	]
	assert.deepEqual([...sdk.mailboxDomainsFor(nodes, keys.routePgp.publicArmored, undefined, keys.userPgp.publicArmored)].sort(), ['A', 'B'])
	assert.equal(sdk.mailboxDomainsFor(nodes, '').size, 0)
})

// The worker entry itself answers hello, refuses provisionIdentity and flags unknown commands.
await check('worker entry hello / unknown_command', async () => {
	const posted: Array<Record<string, unknown>> = []
	let onMessage: ((ev: { data: unknown }) => void) | null = null
	const g = globalThis as Record<string, unknown>
	g.postMessage = (msg: Record<string, unknown>) => posted.push(msg)
	g.addEventListener = (type: string, cb: (ev: { data: unknown }) => void) => {
		if (type === 'message') onMessage = cb
	}
	await import(join(root, 'dist', 'worker', 'entry.js'))
	assert.ok(onMessage, 'worker registered a message listener')
	const send = (data: unknown) => onMessage!({ data })
	send({ type: 'hello', reqId: 7, protocolVersion: 1 })
	send({ type: 'provisionIdentity', reqId: 8, payload: {} })
	send({ type: 'notACommand', reqId: 9 })
	send({ type: 'notACommand', reqId: -1 })
	await new Promise((r) => setTimeout(r, 50))
	const byReq = (id: number) => posted.find((m) => m.reqId === id)
	assert.deepEqual(byReq(7), { type: 'ack', reqId: 7, ok: true, result: sdk.tsWorkerHello() })
	assert.deepEqual(byReq(8), { type: 'ack', reqId: 8, ok: false, error: 'unsupported_command' })
	assert.deepEqual(byReq(9), { type: 'ack', reqId: 9, ok: false, error: 'unknown_command' })
	assert.equal(byReq(-1), undefined)
})

console.log(`chat daemon conformance (ts-worker): ${passed} checks passed`)
