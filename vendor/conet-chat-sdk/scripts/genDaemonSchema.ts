/**
 * Generates spec/chat-daemon-protocol.v1.schema.json from src/protocol.ts (the
 * only source). Each command definition carries its privacy annotation from
 * COMMAND_PRIVACY as `x-privacy`.
 *
 *   npm run spec:schema          # write
 *   npm run spec:schema -- --check   # fail when the file is stale
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from 'ts-json-schema-generator'
import {
	CHAT_DAEMON_CAPABILITIES,
	CHAT_DAEMON_PROTOCOL_VERSION,
	COMMAND_PRIVACY,
} from '../src/protocol.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'spec', `chat-daemon-protocol.v${CHAT_DAEMON_PROTOCOL_VERSION}.schema.json`)

type Def = {
	properties?: Record<string, { const?: unknown; type?: unknown; enum?: unknown[] }>
	[k: string]: unknown
}

const ROOTS = [
	'ChatDaemonCommand',
	'ChatDaemonOutbound',
	'ChatDaemonHello',
	'NativeSignRequest',
	'NativeSignResponse',
	'CommandPrivacy',
]
const generator = createGenerator({
	path: join(root, 'src', 'protocol.ts'),
	tsconfig: join(root, 'tsconfig.json'),
	expose: 'export',
	topRef: true,
	jsDoc: 'extended',
	functions: 'hide',
	skipTypeCheck: true,
	sortProps: true,
})
const definitions: Record<string, Def> = {}
for (const type of ROOTS) {
	Object.assign(definitions, generator.createSchema(type).definitions ?? {})
}
for (const type of ROOTS) if (!definitions[type]) throw new Error(`schema has no ${type}`)

const commandTypes = new Set(Object.keys(COMMAND_PRIVACY))
const annotated = new Set<string>()
for (const def of Object.values(definitions)) {
	const t = def.properties?.type?.const
	if (typeof t !== 'string' || !commandTypes.has(t) || annotated.has(t)) continue
	def['x-privacy'] = COMMAND_PRIVACY[t as keyof typeof COMMAND_PRIVACY]
	annotated.add(t)
}
const missing = [...commandTypes].filter((t) => !annotated.has(t))
if (missing.length) throw new Error(`commands without a schema definition: ${missing.join(', ')}`)

const schema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	$id: `https://github.com/CoNET-project/chat-sdk/spec/chat-daemon-protocol.v${CHAT_DAEMON_PROTOCOL_VERSION}.schema.json`,
	title: `ChatDaemon protocol v${CHAT_DAEMON_PROTOCOL_VERSION}`,
	description:
		'Generated from @conet.project/chat-sdk src/protocol.ts by scripts/genDaemonSchema.ts. Do not edit by hand. ' +
		'A message is either a ChatDaemonCommand (page → daemon) or a ChatDaemonOutbound (daemon → page).',
	'x-protocolVersion': CHAT_DAEMON_PROTOCOL_VERSION,
	'x-capabilities': [...CHAT_DAEMON_CAPABILITIES],
	anyOf: [{ $ref: '#/definitions/ChatDaemonCommand' }, { $ref: '#/definitions/ChatDaemonOutbound' }],
	definitions: Object.fromEntries(Object.entries(definitions).sort(([a], [b]) => a.localeCompare(b))),
}

const text = `${JSON.stringify(schema, null, '\t')}\n`
if (process.argv.includes('--check')) {
	let current = ''
	try {
		current = readFileSync(out, 'utf8')
	} catch {
		/* missing */
	}
	if (current !== text) {
		console.error(`${out} is stale: run npm run spec:schema`)
		process.exit(1)
	}
	console.log('schema up to date')
} else {
	writeFileSync(out, text)
	console.log(`wrote ${out} (${Object.keys(definitions).length} definitions, ${annotated.size} commands annotated)`)
}
