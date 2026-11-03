/**
 * @jest-environment node
 */
import { Wallet } from 'ethers'
import { generateKey } from 'openpgp'
import { cachedReadKey, cachedWallet, prewarmDialKeys, resetDialKeyCacheForTest } from './dialKeyCache'

describe('dialKeyCache', () => {
	beforeEach(() => resetDialKeyCacheForTest())

	it('derives the wallet once per key and follows a key change', () => {
		const a = Wallet.createRandom().privateKey
		const b = Wallet.createRandom().privateKey
		const first = cachedWallet(a)
		expect(cachedWallet(a)).toBe(first)
		expect(first.address).toBe(new Wallet(a).address)
		const other = cachedWallet(b)
		expect(other).not.toBe(first)
		expect(other.address).toBe(new Wallet(b).address)
	})

	it('parses an armored key once, ignoring CR and outer whitespace', async () => {
		const { publicKey } = await generateKey({ type: 'curve25519', userIDs: [{ name: 't' }], format: 'armored' })
		const first = cachedReadKey(publicKey)
		expect(cachedReadKey(`\n${publicKey.replace(/\n/g, '\r\n')}  `)).toBe(first)
		const key = await first
		expect(key.getFingerprint()).toHaveLength(40)
	})

	it('does not keep a failed parse', async () => {
		const bad = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nnot a key\n-----END PGP PUBLIC KEY BLOCK-----'
		const first = cachedReadKey(bad)
		await expect(first).rejects.toBeTruthy()
		expect(cachedReadKey(bad)).not.toBe(first)
		await expect(cachedReadKey(bad)).rejects.toBeTruthy()
	})

	it('prewarm never throws on bad input', () => {
		expect(() => prewarmDialKeys('not-a-key', [undefined, '', 'plain text'])).not.toThrow()
	})
})
