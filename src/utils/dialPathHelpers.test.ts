import { createDialStateGate, mailboxNodeIps } from './dialPathHelpers'

describe('createDialStateGate', () => {
	it('browser: applies the dial state at once, and only once', () => {
		const apply = jest.fn()
		const gate = createDialStateGate(apply, false)
		expect(apply).toHaveBeenCalledTimes(1)
		gate.offerHanded()
		gate.settle()
		expect(apply).toHaveBeenCalledTimes(1)
		expect(gate.applied).toBe(true)
	})

	it('shell: waits for the offer to be handed, then applies once', () => {
		const apply = jest.fn()
		const gate = createDialStateGate(apply, true)
		expect(apply).not.toHaveBeenCalled()
		expect(gate.applied).toBe(false)
		gate.offerHanded()
		expect(apply).toHaveBeenCalledTimes(1)
		gate.settle()
		expect(apply).toHaveBeenCalledTimes(1)
	})

	it('shell: a dial that settles without the hand-off signal still applies once', () => {
		const apply = jest.fn()
		const gate = createDialStateGate(apply, true)
		gate.settle()
		gate.offerHanded()
		expect(apply).toHaveBeenCalledTimes(1)
	})

	it('shell: a dial that fails before the hand-off never applies (the failure path sets its own state)', () => {
		const apply = jest.fn()
		createDialStateGate(apply, true)
		expect(apply).not.toHaveBeenCalled()
	})
})

describe('mailboxNodeIps', () => {
	const key = (id: string) => `-----BEGIN PGP PUBLIC KEY BLOCK-----\n${id}\n-----END PGP PUBLIC KEY BLOCK-----`
	const nodes = [
		{ armoredPublicKey: key('own'), ip_addr: '10.0.0.1' },
		{ armoredPublicKey: key('peer').replace(/\n/g, '\r\n') + '  ', ip_addr: ' 10.0.0.2 ' },
		{ armoredPublicKey: key('other'), ip_addr: '10.0.0.3' },
		{ armoredPublicKey: key('own'), ip_addr: '' },
		{ ip_addr: '10.0.0.5' },
	]

	it('returns the IPs of both mailboxes, matching keys after normalising CR and whitespace', () => {
		expect(mailboxNodeIps(nodes, [key('own'), `\n${key('peer')}\n`])).toEqual(['10.0.0.1', '10.0.0.2'])
	})

	it('ignores empty routes and nodes without an IP or key', () => {
		expect(mailboxNodeIps(nodes, ['', undefined])).toEqual([])
		expect(mailboxNodeIps(nodes, [key('own')])).toEqual(['10.0.0.1'])
	})

	it('matches the old per-node filter on a large node list', () => {
		const many = Array.from({ length: 500 }, (_, i) => ({ armoredPublicKey: key(`n${i}`), ip_addr: `10.1.${i >> 8}.${i & 255}` }))
		const own = key('n7')
		const peer = key('n420')
		const old = many
			.filter((n) => {
				const k = (n.armoredPublicKey || '').replace(/\r/g, '').trim()
				return k === peer.trim() || k === own.trim()
			})
			.map((n) => n.ip_addr)
		expect(mailboxNodeIps(many, [peer, own])).toEqual(old)
	})
})
