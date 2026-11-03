import { ackInboundHashesInBrowser } from './browserInboundAck'

const h = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
const EOA = '0x6e7a4E4aB3be01c8014E64d0C6aDdba7047Db51a'

const makeDeps = (accept: (hash: string) => boolean = () => true) => {
	const sent = new Set<string>()
	const posted: Array<Record<string, unknown>> = []
	return {
		sent,
		posted,
		deps: {
			eoa: EOA,
			post: jest.fn(async (command: Record<string, unknown>) => {
				posted.push(command)
				return accept(String(command.armorHash))
			}),
			isSent: (hash: string) => sent.has(hash),
			noteSent: (hash: string) => { sent.add(hash) },
			nowSeconds: () => 1_800_000_000,
			retryDelayMs: 0,
		},
	}
}

describe('browser inbound mailbox ACK', () => {
	it('ACKs every stored line: voice control, duplicates and history lines alike', async () => {
		const { deps, posted, sent } = makeDeps()
		const accepted = await ackInboundHashesInBrowser([h(1), h(2), h(3)], deps)
		expect(accepted).toBe(3)
		expect(posted).toEqual([1, 2, 3].map((n) => ({
			command: 'gossip_delivery_ack',
			walletAddress: EOA,
			armorHash: h(n),
			timestamp: 1_800_000_000,
		})))
		expect([...sent].sort()).toEqual([h(1), h(2), h(3)])
	})

	it('sends one ACK per hash, also when a line arrived twice or was ACKed elsewhere', async () => {
		const { deps, posted, sent } = makeDeps()
		sent.add(h(2))
		await ackInboundHashesInBrowser([h(1), h(1).toUpperCase().replace('0X', '0x'), h(2), h(1)], deps)
		expect(posted.map((c) => c.armorHash)).toEqual([h(1)])
	})

	it('a refused ACK is retried once through another entry', async () => {
		let refusals = 0
		const { deps, posted, sent } = makeDeps((hash) => {
			if (hash === h(2) && refusals === 0) { refusals += 1; return false }
			return true
		})
		expect(await ackInboundHashesInBrowser([h(1), h(2)], deps)).toBe(2)
		expect(posted.map((c) => c.armorHash).filter((x) => x === h(2))).toHaveLength(2)
		expect(sent.has(h(2))).toBe(true)
	})

	it('a refused ACK is not remembered, so the next delivery is ACKed again', async () => {
		const { deps, sent } = makeDeps((hash) => hash !== h(2))
		const accepted = await ackInboundHashesInBrowser([h(1), h(2), h(3)], deps)
		expect(accepted).toBe(2)
		expect(sent.has(h(2))).toBe(false)
		const retry = makeDeps()
		retry.sent.add(h(1))
		retry.sent.add(h(3))
		await ackInboundHashesInBrowser([h(1), h(2), h(3)], retry.deps)
		expect(retry.posted.map((c) => c.armorHash)).toEqual([h(2)])
	})

	it('a post that throws does not stop the other ACKs', async () => {
		const { deps, sent } = makeDeps()
		deps.post.mockImplementation(async (command: Record<string, unknown>) => {
			if (command.armorHash === h(1)) throw new Error('entry down')
			return true
		})
		const accepted = await ackInboundHashesInBrowser([h(1), h(2), h(3)], { ...deps, concurrency: 1 })
		expect(accepted).toBe(2)
		expect(sent.has(h(1))).toBe(false)
		expect(deps.post).toHaveBeenCalledTimes(4)
	})

	it('ignores malformed hashes and does nothing without a wallet', async () => {
		const { deps, posted } = makeDeps()
		expect(await ackInboundHashesInBrowser(['', 'abc', '0x1234', `${h(1)}00`], deps)).toBe(0)
		expect(await ackInboundHashesInBrowser([h(1)], { ...deps, eoa: '' })).toBe(0)
		expect(posted).toHaveLength(0)
	})

	it('keeps at most `concurrency` posts in flight', async () => {
		let inFlight = 0
		let peak = 0
		const { deps } = makeDeps()
		deps.post.mockImplementation(async () => {
			inFlight += 1
			peak = Math.max(peak, inFlight)
			await new Promise((resolve) => setTimeout(resolve, 5))
			inFlight -= 1
			return true
		})
		const hashes = Array.from({ length: 21 }, (_, i) => h(i + 1))
		expect(await ackInboundHashesInBrowser(hashes, { ...deps, concurrency: 4 })).toBe(21)
		expect(peak).toBe(4)
	})
})
