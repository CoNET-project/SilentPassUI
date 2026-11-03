import { pickRecordedMailbox, planOwnChatRoute, readOwnChainState, recheckListenRoute, resolveCurrentMailbox } from './chatOwnRoutePlan'
import type { OwnChainRead } from './chatOwnRoutePlan'
import type { OwnChainRecord, OwnMailbox, OwnPrivateBlob } from './chatOwnRoutePlan'

const LOCAL = 'D153C4294B9BDB31'
const OTHER = 'AAAAAAAAAAAAAAAA'
const M553: OwnMailbox = { routeKeyID: 'F36E92ECD8F5FCD1', routeArmor: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nM553\n-----END PGP PUBLIC KEY BLOCK-----' }
const M458: OwnMailbox = { routeKeyID: 'B6FF020087998A06', routeArmor: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nM458\n-----END PGP PUBLIC KEY BLOCK-----' }

const chainOk = (over: Partial<{ userKeyID: string; mailbox: OwnMailbox | null; privateBlob: OwnPrivateBlob }> = {}) => ({
	status: 'ok' as const,
	userKeyID: over.userKeyID ?? LOCAL,
	routeKeyID: over.mailbox === null ? '' : (over.mailbox ?? M553).routeKeyID,
	routeArmor: over.mailbox === null ? '' : (over.mailbox ?? M553).routeArmor,
	privateBlob: over.privateBlob ?? 'ok',
})

const record = (mailbox: OwnMailbox, userKeyID = LOCAL): OwnChainRecord => ({
	userKeyID,
	routeKeyID: mailbox.routeKeyID,
	routeArmor: mailbox.routeArmor,
	publicArmored: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nuser\n-----END PGP PUBLIC KEY BLOCK-----',
})

describe('planOwnChatRoute', () => {
	describe('RPC error / timeout: never registers', () => {
		it('keeps the current mailbox (the 2026-11-02 test account case)', () => {
			const plan = planOwnChatRoute({ read: { status: 'error', reason: 'searchKey timeout' }, localKeyID: LOCAL, current: M553, currentArmor: M553.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'keep-current', routeArmor: M553.routeArmor }))
		})
		it('keeps a mailbox known only by armor (node missing from the list)', () => {
			const plan = planOwnChatRoute({ read: { status: 'error', reason: 'x' }, localKeyID: LOCAL, current: null, currentArmor: M553.routeArmor })
			expect(plan.action).toBe('keep-current')
		})
		it('waits and retries when no mailbox is known', () => {
			const plan = planOwnChatRoute({ read: { status: 'error', reason: 'x' }, localKeyID: LOCAL, current: null, currentArmor: '' })
			expect(plan.action).toBe('wait-retry')
		})
	})

	describe('chain empty', () => {
		it('registers on the current mailbox', () => {
			const plan = planOwnChatRoute({ read: { status: 'empty' }, localKeyID: LOCAL, current: M553, currentArmor: M553.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: M553 }))
		})
		it('uses a random mailbox only for a new account', () => {
			const plan = planOwnChatRoute({ read: { status: 'empty' }, localKeyID: LOCAL, current: null, currentArmor: '' })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: 'random' }))
		})
	})

	describe('key mismatch', () => {
		it('registers the local key on the chain mailbox, not a random one', () => {
			const plan = planOwnChatRoute({ read: chainOk({ userKeyID: OTHER }), localKeyID: LOCAL, current: M458, currentArmor: M458.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: M553 }))
		})
		it('falls back to the current mailbox when the chain has no route', () => {
			const plan = planOwnChatRoute({ read: chainOk({ userKeyID: OTHER, mailbox: null }), localKeyID: LOCAL, current: M553, currentArmor: M553.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: M553 }))
		})
		it('compares key IDs case-insensitively', () => {
			const plan = planOwnChatRoute({ read: chainOk({ userKeyID: LOCAL.toLowerCase() }), localKeyID: LOCAL, current: null, currentArmor: '' })
			expect(plan.action).toBe('use-chain')
		})
	})

	describe('chain record matches', () => {
		it('uses the chain mailbox without registering', () => {
			const plan = planOwnChatRoute({ read: chainOk(), localKeyID: LOCAL, current: M458, currentArmor: M458.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'use-chain', mailbox: M553 }))
		})
		it.each(['error', 'undecryptable'] as const)('private blob %s alone is not a reason to register', (blob) => {
			const plan = planOwnChatRoute({ read: chainOk({ privateBlob: blob }), localKeyID: LOCAL, current: M553, currentArmor: M553.routeArmor })
			expect(plan.action).toBe('use-chain')
		})
		it('a blob that is absent on chain is repaired on the chain mailbox', () => {
			const plan = planOwnChatRoute({ read: chainOk({ privateBlob: 'missing' }), localKeyID: LOCAL, current: M458, currentArmor: M458.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: M553 }))
		})
		it('no route on chain registers on the current mailbox', () => {
			const plan = planOwnChatRoute({ read: chainOk({ mailbox: null }), localKeyID: LOCAL, current: M553, currentArmor: M553.routeArmor })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: M553 }))
		})
		it('no route and no mailbox yet → random', () => {
			const plan = planOwnChatRoute({ read: chainOk({ mailbox: null }), localKeyID: LOCAL, current: null, currentArmor: '' })
			expect(plan).toEqual(expect.objectContaining({ action: 'register', target: 'random' }))
		})
	})

	it('unreadable local key ID never overwrites the chain record', () => {
		const plan = planOwnChatRoute({ read: chainOk({ userKeyID: OTHER }), localKeyID: '', current: M458, currentArmor: M458.routeArmor })
		expect(plan).toEqual(expect.objectContaining({ action: 'use-chain', mailbox: M553 }))
	})
})

describe('readOwnChainState', () => {
	const neverBlob = () => Promise.reject(new Error('should not be asked'))

	it('RPC error → error, never empty', async () => {
		const r = await readOwnChainState({ first: null, searchKey: () => Promise.reject(new Error('could not detect network')), probeBlob: neverBlob })
		expect(r.read).toEqual({ status: 'error', reason: 'could not detect network' })
	})

	it('RPC timeout → error', async () => {
		const r = await readOwnChainState({ first: null, searchKey: () => new Promise(() => {}), probeBlob: neverBlob, timeoutMs: 20 })
		expect(r.read).toEqual({ status: 'error', reason: 'searchKey timeout' })
	})

	it('chain has no record → empty', async () => {
		const r = await readOwnChainState({ first: null, searchKey: async () => null, probeBlob: neverBlob })
		expect(r.read).toEqual({ status: 'empty' })
	})

	it('first read failed but the second finds the record → ok, with blob probed', async () => {
		const r = await readOwnChainState({
			first: null,
			searchKey: async () => record(M553),
			probeBlob: async () => ({ state: 'ok', armored: 'PRIVATE' }),
		})
		expect(r.read).toEqual(chainOk())
		expect(r.privateArmored).toBe('PRIVATE')
	})

	it('first read with private key → ok, no extra calls', async () => {
		const r = await readOwnChainState({
			first: { ...record(M553), privateArmored: 'PRIVATE' },
			searchKey: () => Promise.reject(new Error('should not be asked')),
			probeBlob: neverBlob,
		})
		expect(r.read).toEqual(chainOk())
	})

	it('blob RPC error or timeout → privateBlob error (record still ok)', async () => {
		const a = await readOwnChainState({ first: record(M553), searchKey: async () => null, probeBlob: () => Promise.reject(new Error('rpc')) })
		expect(a.read).toEqual(chainOk({ privateBlob: 'error' }))
		const b = await readOwnChainState({ first: record(M553), searchKey: async () => null, probeBlob: () => new Promise(() => {}), timeoutMs: 20 })
		expect(b.read).toEqual(chainOk({ privateBlob: 'error' }))
	})

	it('end to end: RPC error with a known mailbox keeps it', async () => {
		const own = await readOwnChainState({ first: null, searchKey: () => Promise.reject(new Error('timeout')), probeBlob: neverBlob })
		const cur = resolveCurrentMailbox(M553.routeArmor, [{ domain: M553.routeKeyID, armoredPublicKey: M553.routeArmor }], null)
		expect(planOwnChatRoute({ read: own.read, localKeyID: LOCAL, current: cur.mailbox, currentArmor: cur.armor }).action).toBe('keep-current')
	})
})

describe('resolveCurrentMailbox', () => {
	const nodes = [
		{ domain: M458.routeKeyID, armoredPublicKey: M458.routeArmor },
		{ domain: M553.routeKeyID, armoredPublicKey: `${M553.routeArmor.replace(/\n/g, '\r\n')}\n` },
	]
	it('finds the route key ID by armor (ignoring CR and outer whitespace)', () => {
		expect(resolveCurrentMailbox(M553.routeArmor, nodes, null)).toEqual({ armor: M553.routeArmor, mailbox: M553 })
	})
	it('armor not in the node list: armor kept, key ID from the cache if it matches', () => {
		expect(resolveCurrentMailbox(M553.routeArmor, [], null)).toEqual({ armor: M553.routeArmor, mailbox: null })
		expect(resolveCurrentMailbox(M553.routeArmor, [], M553)).toEqual({ armor: M553.routeArmor, mailbox: M553 })
		expect(resolveCurrentMailbox(M553.routeArmor, [], M458)).toEqual({ armor: M553.routeArmor, mailbox: null })
	})
	it('no local router: uses the cache, else nothing', () => {
		expect(resolveCurrentMailbox('', nodes, M458)).toEqual({ armor: M458.routeArmor, mailbox: M458 })
		expect(resolveCurrentMailbox('', nodes, null)).toEqual({ armor: '', mailbox: null })
	})
})

describe('recheckListenRoute (airplane mode, then back online)', () => {
	// M234 stands in for the stray mailbox of the RC3 Samsung run; the chain says M458.
	const M234: OwnMailbox = { routeKeyID: 'C0FFEE0000000234', routeArmor: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nM234\n-----END PGP PUBLIC KEY BLOCK-----' }
	const offline: OwnChainRead = { status: 'error', reason: 'could not detect network' }

	it('keeps the listen while offline, then ends on the chain mailbox', async () => {
		// initChat in airplane mode: read fails → keep the mailbox it had, no register, no random.
		let listen = planOwnChatRoute({ read: offline, localKeyID: LOCAL, current: M234, currentArmor: M234.routeArmor })
		expect(listen).toEqual(expect.objectContaining({ action: 'keep-current', routeArmor: M234.routeArmor }))
		let listenArmor = listen.action === 'keep-current' ? listen.routeArmor : ''

		const reads: OwnChainRead[] = [offline, offline, chainOk({ mailbox: M458 })]
		const waits: number[] = []
		const listenWhileOffline: string[] = []
		const r = await recheckListenRoute({
			listenArmor: () => listenArmor,
			read: async () => reads.shift()!,
			localKeyID: LOCAL,
			sleep: async (ms) => { waits.push(ms); listenWhileOffline.push(listenArmor); return true },
		})
		expect(waits).toEqual([5_000, 15_000])
		expect(listenWhileOffline.every((a) => a === M234.routeArmor)).toBe(true)
		expect(r.result).toBe('reinit')

		// Back online: chat starts again with a working read → listen on the chain mailbox.
		listen = planOwnChatRoute({ read: r.read!, localKeyID: LOCAL, current: M234, currentArmor: M234.routeArmor })
		expect(listen).toEqual(expect.objectContaining({ action: 'use-chain', mailbox: M458 }))
		listenArmor = listen.action === 'use-chain' ? listen.mailbox.routeArmor : ''
		expect(listenArmor).toBe(M458.routeArmor)
	})

	it('a read that throws counts as offline, not as an empty chain', async () => {
		let n = 0
		const r = await recheckListenRoute({
			listenArmor: () => M234.routeArmor,
			read: async () => { if (n++ === 0) throw new Error('timeout'); return chainOk({ mailbox: M234 }) },
			localKeyID: LOCAL,
			sleep: async () => true,
		})
		expect(r.result).toBe('match')
	})

	it('chain names the mailbox we listen on → match, no restart', async () => {
		const r = await recheckListenRoute({ listenArmor: () => M458.routeArmor, read: async () => chainOk({ mailbox: M458 }), localKeyID: LOCAL, sleep: async () => true })
		expect(r.result).toBe('match')
	})

	it('chain empty or another user key → reinit (initChat registers on the current mailbox)', async () => {
		for (const read of [{ status: 'empty' } as OwnChainRead, chainOk({ userKeyID: OTHER, mailbox: M234 })]) {
			const r = await recheckListenRoute({ listenArmor: () => M234.routeArmor, read: async () => read, localKeyID: LOCAL, sleep: async () => true })
			expect(r.result).toBe('reinit')
		}
	})

	it('stops when the session is gone, and backs off up to 5 min', async () => {
		const waits: number[] = []
		const r = await recheckListenRoute({
			listenArmor: () => M234.routeArmor,
			read: async () => offline,
			localKeyID: LOCAL,
			sleep: async (ms) => { waits.push(ms); return waits.length < 8 },
		})
		expect(r.result).toBe('gone')
		expect(waits).toEqual([5_000, 15_000, 30_000, 60_000, 120_000, 300_000, 300_000, 300_000])
	})
})

describe('pickRecordedMailbox (new mailbox only on a node AddressPGP recorded)', () => {
	const nodes = [{ domain: '60F7767D9F2174CA' }, { domain: '01B67C184BE19C55' }, { domain: 'B6FF020087998A06' }, { domain: 'F36E92ECD8F5FCD1' }]
	const recorded = new Set(['B6FF020087998A06', 'F36E92ECD8F5FCD1'])

	it('skips unrecorded nodes (#570, #355) and takes the first recorded one', async () => {
		const asked: string[] = []
		const r = await pickRecordedMailbox({ candidates: nodes, routeKeyID: (n) => n.domain, isRecorded: async (id) => { asked.push(id); return recorded.has(id) } })
		expect(r).toEqual({ status: 'ok', node: nodes[2], skipped: ['60F7767D9F2174CA', '01B67C184BE19C55'] })
		expect(asked).toEqual(['60F7767D9F2174CA', '01B67C184BE19C55', 'B6FF020087998A06'])
	})

	it('a failed check (RPC error) picks nothing, even if later nodes would pass', async () => {
		const r = await pickRecordedMailbox({
			candidates: nodes,
			routeKeyID: (n) => n.domain,
			isRecorded: async (id) => { if (id === '01B67C184BE19C55') throw new Error('could not detect network'); return recorded.has(id) },
		})
		expect(r).toEqual({ status: 'error', reason: 'could not detect network', skipped: ['60F7767D9F2174CA'] })
	})

	it('a check that hangs times out as an error', async () => {
		const r = await pickRecordedMailbox({ candidates: nodes, routeKeyID: (n) => n.domain, isRecorded: () => new Promise(() => {}), timeoutMs: 20 })
		expect(r.status).toBe('error')
	})

	it('none recorded within maxChecks → none (caller does not register)', async () => {
		const r = await pickRecordedMailbox({ candidates: nodes, routeKeyID: (n) => n.domain, isRecorded: async () => false, maxChecks: 3 })
		expect(r).toEqual({ status: 'none', skipped: ['60F7767D9F2174CA', '01B67C184BE19C55', 'B6FF020087998A06'] })
	})

	it('ignores empty and duplicate route key IDs', async () => {
		const asked: string[] = []
		const r = await pickRecordedMailbox({
			candidates: ['', '60f7767d9f2174ca', '60F7767D9F2174CA', 'B6FF020087998A06'],
			routeKeyID: (id) => id,
			isRecorded: async (id) => { asked.push(id); return recorded.has(id) },
		})
		expect(r.status).toBe('ok')
		expect(asked).toEqual(['60f7767d9f2174ca', 'B6FF020087998A06'])
	})
})
