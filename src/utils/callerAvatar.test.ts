jest.mock('@dicebear/core', () => ({ createAvatar: (_style: unknown, opts: { seed: string }) => ({ toDataUri: () => `data:image/svg+xml;seed=${opts.seed}` }) }), { virtual: true })
jest.mock('@dicebear/collection', () => ({ funEmoji: {} }), { virtual: true })
jest.mock('./cashTreesNativeNfc', () => ({ dispatchNativeSystemCallAction: () => true, getCashTreesNativeNfcHost: () => null }))

import { callerAvatarRowsToSync, callerAvatarSeed, localCallerAvatarDataUri } from './callerAvatar'

const a1 = '0x48952F9EA1231b59e5c5FA1a99BC657B122CFDfD'
const a2 = '0x1111222233334444555566667777888899990000'

test('the seed is the verified tag without "@"; placeholders and addresses give none', () => {
	expect(callerAvatarSeed('@CONET')).toBe('CONET')
	expect(callerAvatarSeed('CONET')).toBe('CONET')
	expect(callerAvatarSeed('@Beamio')).toBe('')
	expect(callerAvatarSeed('unknown')).toBe('')
	expect(callerAvatarSeed(a1)).toBe('')
	expect(callerAvatarSeed(undefined)).toBe('')
})

test('the avatar is generated locally from the seed (same seed as the chat list)', () => {
	expect(localCallerAvatarDataUri('@CONET')).toBe('data:image/svg+xml;seed=CONET')
	expect(localCallerAvatarDataUri('')).toBe('')
})

test('rows to hand to the shell: valid wallet + tag, once each', () => {
	const rows = callerAvatarRowsToSync([
		{ address: a1, tag: '@CONET' },
		{ address: a1, tag: 'CONET' }, // duplicate
		{ address: a2, tag: '' }, // no verified tag
		{ address: 'not-an-address', tag: '@x' },
	], new Set())
	expect(rows).toEqual([{ address: a1.toLowerCase(), tag: 'CONET', key: `${a1.toLowerCase()}:conet` }])
	expect(callerAvatarRowsToSync([{ address: a1, tag: '@CONET' }], new Set([`${a1.toLowerCase()}:conet`]))).toEqual([])
})

test('a changed tag for the same wallet is sent again', () => {
	const rows = callerAvatarRowsToSync([{ address: a1, tag: '@NEWTAG' }], new Set([`${a1.toLowerCase()}:conet`]))
	expect(rows.map(r => r.tag)).toEqual(['NEWTAG'])
})
