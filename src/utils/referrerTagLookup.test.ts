jest.mock('@dicebear/core', () => ({ createAvatar: (_style: unknown, opts: { seed: string }) => ({ toDataUri: () => `data:image/svg+xml;seed=${opts.seed}` }) }), { virtual: true })
jest.mock('@dicebear/collection', () => ({ funEmoji: {} }), { virtual: true })
jest.mock('./cashTreesNativeNfc', () => ({ dispatchNativeSystemCallAction: () => true, getCashTreesNativeNfcHost: () => null }))

import {
	DEFAULT_AVATAR_SEED,
	REFERRER_TAG_SEARCH_URL,
	lookupReferrerTag,
	referrerAvatarDataUri,
	referrerTagFromSearchResponse,
	resetReferrerTagCacheForTests,
} from './referrerTagLookup'

const REFERRER = '0x6ed7ba4e9a2b7c3d0f1e2a3b4c5d6e7f8a9b0195'
const OTHER = '0x1111111111111111111111111111111111111111'

const okJson = (body: unknown) => jest.fn(async () => ({ ok: true, json: async () => body }))

beforeEach(() => resetReferrerTagCacheForTests())

describe('lookupReferrerTag', () => {
	it('returns the @tag when the API knows the address', async () => {
		const fetchImpl = okJson({ results: [{ address: REFERRER.toLowerCase(), username: 'developTemp3' }] })
		await expect(lookupReferrerTag(REFERRER, { fetchImpl })).resolves.toBe('@developTemp3')
	})

	it('sends only the referrer address, without cookies or referrer header', async () => {
		const fetchImpl = okJson({ results: [] })
		await lookupReferrerTag(REFERRER, { fetchImpl })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
		const parsed = new URL(url)
		expect(`${parsed.origin}${parsed.pathname}`).toBe(REFERRER_TAG_SEARCH_URL)
		expect([...parsed.searchParams.keys()]).toEqual(['keyward'])
		expect(parsed.searchParams.get('keyward')?.toLowerCase()).toBe(REFERRER.toLowerCase())
		expect(init).toMatchObject({ method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer' })
		expect(init.body).toBeUndefined()
		expect(init.headers).toBeUndefined()
	})

	it('returns empty when the address has no tag', async () => {
		const placeholder = okJson({ results: [{ address: REFERRER.toLowerCase(), username: 'unknow' }] })
		await expect(lookupReferrerTag(REFERRER, { fetchImpl: placeholder })).resolves.toBe('')
		const empty = okJson({ results: [] })
		await expect(lookupReferrerTag(REFERRER, { fetchImpl: empty })).resolves.toBe('')
	})

	it("never shows another account's tag", async () => {
		const fetchImpl = okJson({ results: [{ address: OTHER, username: 'someoneElse' }] })
		await expect(lookupReferrerTag(REFERRER, { fetchImpl })).resolves.toBe('')
	})

	it('returns empty on timeout and does not wait for the request', async () => {
		jest.useFakeTimers()
		try {
			const fetchImpl = jest.fn(() => new Promise<never>(() => {}))
			const result = lookupReferrerTag(REFERRER, { fetchImpl, timeoutMs: 4000 })
			jest.advanceTimersByTime(4000)
			await expect(result).resolves.toBe('')
		} finally {
			jest.useRealTimers()
		}
	})

	it('returns empty on HTTP errors, network errors and bad input', async () => {
		const httpError = jest.fn(async () => ({ ok: false, json: async () => ({}) }))
		await expect(lookupReferrerTag(REFERRER, { fetchImpl: httpError })).resolves.toBe('')
		const offline = jest.fn(async () => { throw new TypeError('Failed to fetch') })
		await expect(lookupReferrerTag(REFERRER, { fetchImpl: offline })).resolves.toBe('')
		const unused = okJson({})
		await expect(lookupReferrerTag('not-an-address', { fetchImpl: unused })).resolves.toBe('')
		expect(unused).not.toHaveBeenCalled()
	})

	it('caches a found tag and shares one request between callers', async () => {
		const fetchImpl = okJson({ results: [{ address: REFERRER, accountName: 'developTemp3' }] })
		const [a, b] = await Promise.all([
			lookupReferrerTag(REFERRER, { fetchImpl }),
			lookupReferrerTag(REFERRER.toLowerCase(), { fetchImpl }),
		])
		expect([a, b]).toEqual(['@developTemp3', '@developTemp3'])
		await lookupReferrerTag(REFERRER, { fetchImpl })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
	})
})

describe('referrerTagFromSearchResponse', () => {
	it('reads accountName or username of the exact row only', () => {
		const res = { results: [{ address: OTHER, username: 'x' }, { address: REFERRER, accountName: '@developTemp3' }] }
		expect(referrerTagFromSearchResponse(res, REFERRER)).toBe('@developTemp3')
		expect(referrerTagFromSearchResponse(null, REFERRER)).toBe('')
		expect(referrerTagFromSearchResponse({ results: 'bad' }, REFERRER)).toBe('')
	})
})

describe('referrerAvatarDataUri', () => {
	it('draws the avatar locally from the tag, with the chat list seed (tag without "@")', () => {
		expect(referrerAvatarDataUri('@developTemp3')).toBe('data:image/svg+xml;seed=developTemp3')
	})

	it('uses the chat list default avatar when there is no tag', () => {
		expect(DEFAULT_AVATAR_SEED).toBe('@Beamio')
		expect(referrerAvatarDataUri('')).toBe('data:image/svg+xml;seed=@Beamio')
		expect(referrerAvatarDataUri(undefined)).toBe('data:image/svg+xml;seed=@Beamio')
		expect(referrerAvatarDataUri('unknow')).toBe('data:image/svg+xml;seed=@Beamio')
	})
})
