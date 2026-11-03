/**
 * Writes spec/chat-daemon-vectors.v1.json — the shared conformance vectors for
 * the TS Worker, chat-sdk-ios and chat-sdk-android.
 *
 * Run once. The armors and test keys are random, so a re-run changes every
 * vector: only do it on purpose (`--force`), then copy the file into both
 * native repos (their `scripts/sync-protocol-vectors.sh`).
 *
 *   node scripts/genDaemonVectors.ts --force
 *
 * All keys here are throwaway test keys made for these vectors. Never use them
 * for anything else.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMessage, encrypt, enums, generateKey, readKey } from 'openpgp'
import { ethers } from 'ethers'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'spec', 'chat-daemon-vectors.v1.json')
if (existsSync(out) && !process.argv.includes('--force')) {
	console.error(`${out} exists. Pass --force to regenerate (changes every vector).`)
	process.exit(1)
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const keccak = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s))

async function encryptText(text: string, publicArmor: string): Promise<string> {
	return (await encrypt({
		message: await createMessage({ text }),
		encryptionKeys: await readKey({ armoredKey: publicArmor }),
		config: { preferredCompressionAlgorithm: enums.compression.zlib },
	})) as string
}

async function pgpKey(name: string) {
	const k = await generateKey({
		type: 'ecc',
		curve: 'curve25519Legacy',
		userIDs: [{ name, email: `${name.toLowerCase().replace(/\s+/g, '-')}@vectors.invalid` }],
		format: 'armored',
	})
	return { privateArmored: k.privateKey, publicArmored: k.publicKey }
}

// ethers documentation sample key: public, test only.
const wallet = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123')
const userPgp = await pgpKey('Vector User')
const routePgp = await pgpKey('Vector Route')

const eip191Messages = [
	'hello',
	JSON.stringify({ command: 'mailbox_listen', walletAddress: wallet.address, instanceId: 'vec-1', timestamp: 1730419200 }),
	'héllo 世界 🎉',
]
const eip191 = []
for (const message of eip191Messages) {
	eip191.push({ message, signature: await wallet.signMessage(message), signer: wallet.address })
}

// Business envelope (rule 22: the signature lives only inside the user-PGP layer).
const pendingRow = JSON.stringify({ sendId: 'vec-send-1', from: 'me', text: 'hi from the vectors', createdAt: 1730419200000 })
const chatEnvelope = {
	timestamp: 1730419200123,
	text: pendingRow,
	from: wallet.address,
	signMessage: await wallet.signMessage(pendingRow),
}
const businessArmor = await encryptText(b64(JSON.stringify(chatEnvelope)), userPgp.publicArmored)

// Signed route command to the own mailbox.
const ackCommand = {
	command: 'gossip_delivery_ack',
	walletAddress: wallet.address,
	armorHash: keccak(businessArmor),
	timestamp: 1730419200,
}
const ackMessage = JSON.stringify(ackCommand)
const routeLiteral = { message: ackMessage, signMessage: await wallet.signMessage(ackMessage) }
const routeArmor = await encryptText(b64(JSON.stringify(routeLiteral)), routePgp.publicArmored)

// Mailbox work (NoPush) to the recipient mailbox route key.
const mailboxWork = { data: businessArmor, NoPush: true }
const mailboxWorkArmor = await encryptText(JSON.stringify(mailboxWork), routePgp.publicArmored)

const shortArmor = '-----BEGIN PGP MESSAGE-----\n\nwcBMA0vector\n=abcd\n-----END PGP MESSAGE-----'
const unicodeArmor = '-----BEGIN PGP MESSAGE-----\n\nComment: 世界\n-----END PGP MESSAGE-----'

const offer = { type: 'voice_call_offer_v1', callId: 'c-offer', sessionId: 's-offer', from: '0xclaimed', to: '0xpeer' }
const end = { type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end', reason: 'ended' }
const timeout = { type: 'voice_call_timeout_v1', callId: 'c-timeout', sessionId: '', reason: 'timeout' }
const outer = (text: string) => JSON.stringify({ timestamp: 1, text, from: '0xclaimed', signMessage: '0xsig' })
const pending = (inner: unknown) => JSON.stringify({ sendId: 'p', from: 'me', text: JSON.stringify(inner), createdAt: 1 })
let deep: unknown = end
for (let i = 0; i < 12; i++) deep = { wrap: deep }

const busyReject = JSON.stringify({ type: 'voice_call_reject_v1', callId: 'c-busy', sessionId: 's-busy', reason: 'busy' })
const callSignal = [
	{ name: 'plain end object', line: JSON.stringify(end), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end' } },
	{ name: 'end in pending row in envelope', line: outer(pending(end)), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end' } },
	{ name: 'base64 envelope', line: b64(outer(pending(end))), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end' } },
	{ name: 'base64 text field', line: JSON.stringify({ timestamp: 1, text: b64(pending(timeout)), signMessage: '0x' }), expect: { kind: 'timeout', type: 'voice_call_timeout_v1', callId: 'c-timeout', sessionId: '' } },
	{ name: 'offer', line: outer(pending(offer)), expect: { kind: 'offer', type: 'voice_call_offer_v1', callId: 'c-offer', sessionId: 's-offer' } },
	{ name: 'accept', line: JSON.stringify({ type: 'voice_call_accept_v1', callId: 'c-a', sessionId: 's-a' }), expect: { kind: 'accept', type: 'voice_call_accept_v1', callId: 'c-a', sessionId: 's-a' } },
	{ name: 'reject', line: JSON.stringify({ type: 'voice_call_reject_v1', callId: 'c-r', sessionId: '' }), expect: { kind: 'reject', type: 'voice_call_reject_v1', callId: 'c-r', sessionId: '', rejectReason: 'declined' } },
	// Busy: the callee is in another call (the caller plays a busy tone). Only the exact reason "busy".
	{ name: 'reject busy (callee in another call)', line: busyReject, expect: { kind: 'reject', type: 'voice_call_reject_v1', callId: 'c-busy', sessionId: 's-busy', rejectReason: 'busy' } },
	{ name: 'reject busy in envelope', line: JSON.stringify({ timestamp: 1, text: busyReject, from: '0xclaimed', signMessage: '0xsig' }), expect: { kind: 'reject', type: 'voice_call_reject_v1', callId: 'c-busy', sessionId: 's-busy', rejectReason: 'busy' } },
	{ name: 'reject with another reason is declined', line: JSON.stringify({ type: 'voice_call_reject_v1', callId: 'c-d', sessionId: 's-d', reason: 'BUSY ' }), expect: { kind: 'reject', type: 'voice_call_reject_v1', callId: 'c-d', sessionId: 's-d', rejectReason: 'declined' } },
	{ name: 'ringing in envelope', line: outer(pending({ type: 'voice_call_ringing_v1', callId: 'c-ring', sessionId: 's-ring', from: '0xcallee', to: '0xcaller' })), expect: { kind: 'ringing', type: 'voice_call_ringing_v1', callId: 'c-ring', sessionId: 's-ring' } },
	{ name: 'ids are trimmed', line: JSON.stringify({ type: 'voice_end_v1', callId: '  c-trim  ', sessionId: '\ts-trim\n' }), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-trim', sessionId: 's-trim' } },
	{ name: 'nested object key', line: JSON.stringify({ meta: { signal: end } }), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end' } },
	{ name: 'array element', line: JSON.stringify([{ type: 'chat' }, end]), expect: { kind: 'end', type: 'voice_end_v1', callId: 'c-end', sessionId: 's-end' } },
	{ name: 'no ids', line: JSON.stringify({ type: 'voice_end_v1', callId: '', sessionId: '' }), expect: null },
	{ name: 'numeric ids do not count', line: JSON.stringify({ type: 'voice_end_v1', callId: 42, sessionId: 7 }), expect: null },
	{ name: 'other type', line: JSON.stringify({ type: 'voice_frame_v1', callId: 'c', sessionId: 's' }), expect: null },
	{ name: 'plain chat text', line: outer(pending({ type: 'text', body: 'voice_end_v1 is just words here' })), expect: null },
	{ name: 'not json, not base64', line: 'hello there', expect: null },
	{ name: 'broken json', line: '{"type":"voice_end_v1","callId":"c"', expect: null },
	{ name: 'too deep', line: JSON.stringify(deep), expect: null },
	{ name: 'empty', line: '', expect: null },
]

const tsCaps = ['history.v2', 'voice.channelV2', 'group.v1', 'presence.query', 'mailbox.command', 'send.mailboxWrap']
const nativeCaps = [
	'identity.provision',
	'signing.local',
	'lifecycle.daemon',
	'inbound.deferAck',
	'history.v2',
	'call.control',
	'voice.delegated',
	'presence.query',
	'mailbox.command',
	'send.mailboxWrap',
]

const vectors = {
	$comment:
		'ChatDaemon protocol v1 shared conformance vectors. Source: @conet.project/chat-sdk spec/. Keys are throwaway test keys. Copy, do not edit, in chat-sdk-ios / chat-sdk-android.',
	vectorsVersion: 1,
	protocolVersion: 1,
	keys: {
		wallet: { privateKey: wallet.privateKey, address: wallet.address },
		userPgp,
		routePgp,
	},
	eip191,
	envelopes: [
		{
			name: 'business',
			description: 'User-PGP layer of a chat message: base64(UTF-8 JSON { timestamp, text, from, signMessage }); signMessage = EIP-191(text).',
			decryptWith: 'userPgp',
			literal: 'base64-json',
			armor: businessArmor,
			armorHash: keccak(businessArmor),
			expect: chatEnvelope,
			signed: { textField: 'text', signatureField: 'signMessage', signer: wallet.address },
		},
		{
			name: 'routeCommand',
			description: 'Signed mailbox command: base64(UTF-8 JSON { message, signMessage }) to a route key; message = JSON(command).',
			decryptWith: 'routePgp',
			literal: 'base64-json',
			armor: routeArmor,
			armorHash: keccak(routeArmor),
			expect: routeLiteral,
			messageJson: ackCommand,
			signed: { textField: 'message', signatureField: 'signMessage', signer: wallet.address },
		},
		{
			name: 'mailboxWork',
			description: 'Mailbox work to the recipient mailbox route key: UTF-8 JSON { data: <user-PGP armor>, NoPush: true } (not base64).',
			decryptWith: 'routePgp',
			literal: 'json',
			armor: mailboxWorkArmor,
			armorHash: keccak(mailboxWorkArmor),
			expect: mailboxWork,
		},
	],
	ackHash: [
		{ name: 'business armor', armor: businessArmor, armorHash: keccak(businessArmor) },
		{ name: 'short armor', armor: shortArmor, armorHash: keccak(shortArmor) },
		{ name: 'unicode armor', armor: unicodeArmor, armorHash: keccak(unicodeArmor) },
	],
	builders: [
		{
			name: 'deliveryAckCommand',
			input: { eoa: wallet.address.toLowerCase(), armorHash: keccak(shortArmor), timestamp: 1730419200 },
			expect: { command: 'gossip_delivery_ack', walletAddress: wallet.address.toLowerCase(), armorHash: keccak(shortArmor), timestamp: 1730419200 },
		},
		{
			name: 'deliveryReceipt',
			input: { sendId: 'vec-send-1', armorHash: keccak(shortArmor), deliveredAt: 1730419200999, eoa: wallet.address.toLowerCase() },
			expect: { type: 'beamio_chat_delivery_receipt_v1', sendId: 'vec-send-1', armorHash: keccak(shortArmor), deliveredAt: 1730419200999, from: wallet.address.toLowerCase() },
		},
		{
			name: 'pendingRow',
			input: { sendId: 'vec-row-1', text: '{"type":"beamio_chat_delivery_receipt_v1"}', createdAt: 1730419201000 },
			expect: { sendId: 'vec-row-1', from: 'me', text: '{"type":"beamio_chat_delivery_receipt_v1"}', createdAt: 1730419201000 },
		},
		{
			name: 'chatEnvelope',
			input: { timestamp: chatEnvelope.timestamp, text: chatEnvelope.text, from: chatEnvelope.from, signMessage: chatEnvelope.signMessage },
			expect: chatEnvelope,
		},
		{
			name: 'mailboxWork',
			input: { data: shortArmor, noPush: true },
			expect: { data: shortArmor, NoPush: true },
		},
		{
			name: 'mailboxWorkPush',
			input: { data: shortArmor, noPush: false },
			expect: { data: shortArmor },
		},
	],
	callSignal,
	hello: {
		capabilities: [
			'identity.provision',
			'signing.local',
			'lifecycle.daemon',
			'inbound.deferAck',
			'history.v2',
			'call.control',
			'voice.channelV2',
			'voice.delegated',
			'group.v1',
			'presence.query',
			'mailbox.command',
			'send.mailboxWrap',
		],
		implementations: {
			'ts-worker': { protocolVersion: 1, minProtocolVersion: 1, capabilities: tsCaps },
			ios: { protocolVersion: 1, minProtocolVersion: 1, capabilities: nativeCaps },
			android: { protocolVersion: 1, minProtocolVersion: 1, capabilities: nativeCaps },
		},
		negotiation: [
			{ name: 'no answer (shell older than v1)', reply: null, expect: { status: 'legacy', protocolVersion: 0, capabilities: [] } },
			{
				name: 'native v1',
				reply: { protocolVersion: 1, minProtocolVersion: 1, sdkVersion: '0.1.8', implementation: 'ios', capabilities: nativeCaps },
				expect: { status: 'negotiated', protocolVersion: 1, capabilities: nativeCaps },
			},
			{
				name: 'unknown capabilities are dropped, order follows the spec',
				reply: { protocolVersion: 1, sdkVersion: '0.2.6', implementation: 'android', capabilities: ['future.thing', 'mailbox.command', 'history.v2', 'history.v2'] },
				expect: { status: 'negotiated', protocolVersion: 1, capabilities: ['history.v2', 'mailbox.command'] },
			},
			{
				name: 'newer daemon that still speaks v1',
				reply: { protocolVersion: 3, minProtocolVersion: 1, sdkVersion: '9.0.0', implementation: 'ios', capabilities: ['history.v2', 'group.v2'] },
				expect: { status: 'negotiated', protocolVersion: 3, capabilities: ['history.v2'] },
			},
			{
				name: 'daemon that dropped v1',
				reply: { protocolVersion: 3, minProtocolVersion: 2, sdkVersion: '9.0.0', implementation: 'ios', capabilities: ['history.v2'] },
				expect: { status: 'incompatible', protocolVersion: 3, capabilities: [] },
			},
			{
				name: 'version as a string is malformed',
				reply: { protocolVersion: '1', sdkVersion: '0.1.8', implementation: 'ios', capabilities: ['history.v2'] },
				expect: { status: 'legacy', protocolVersion: 0, capabilities: [] },
			},
			{
				name: 'missing capabilities is malformed',
				reply: { protocolVersion: 1, sdkVersion: '0.1.8', implementation: 'ios' },
				expect: { status: 'legacy', protocolVersion: 0, capabilities: [] },
			},
			{
				name: 'error ack result',
				reply: 'unknown_command',
				expect: { status: 'legacy', protocolVersion: 0, capabilities: [] },
			},
		],
	},
}

writeFileSync(out, `${JSON.stringify(vectors, null, '\t')}\n`)
console.log(`wrote ${out}`)
