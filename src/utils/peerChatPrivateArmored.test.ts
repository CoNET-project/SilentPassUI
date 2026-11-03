import { stripPeerChatPrivateArmored } from './peerChatPrivateArmored'

const OWN_KEY = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nown\n-----END PGP PRIVATE KEY BLOCK-----'

const chat = (address: string, chatData: Record<string, unknown> | undefined) => ({
	address,
	messages: [{ id: 'm1' }],
	pin: false,
	chatData,
})

const peerData = (extra: Record<string, unknown> = {}) => ({
	publicArmored: 'PUB',
	routersArmoreds: 'ROUTE',
	online: false,
	routePgpKeyID: 'R1',
	...extra,
})

describe('stripPeerChatPrivateArmored', () => {
	it('removes a stored copy of our private key and asks for a write-back', () => {
		const data = {
			mnemonicPhrase: 'x',
			profiles: [{ keyID: '0xme', privateKeyArmor: '0xabc', chats: [chat('0xa', peerData({ privateArmored: OWN_KEY })), chat('0xb', peerData())] }],
		}
		const { data: out, changed } = stripPeerChatPrivateArmored(data)
		expect(changed).toBe(true)
		const chats = (out.profiles as any[])[0].chats
		expect('privateArmored' in chats[0].chatData).toBe(false)
		expect(chats[0].chatData).toEqual(peerData())
		expect(chats[0].messages).toEqual([{ id: 'm1' }])
		expect(chats[1]).toBe(data.profiles[0].chats[1])
		// Own wallet fields and other top-level data stay.
		expect((out.profiles as any[])[0].privateKeyArmor).toBe('0xabc')
		expect(out.mnemonicPhrase).toBe('x')
		expect(JSON.stringify(out)).not.toContain('PGP PRIVATE KEY')
	})

	it('does not mutate the input', () => {
		const data = { profiles: [{ chats: [chat('0xa', peerData({ privateArmored: OWN_KEY }))] }] }
		stripPeerChatPrivateArmored(data)
		expect(data.profiles[0].chats[0].chatData?.privateArmored).toBe(OWN_KEY)
	})

	it('drops empty keys without asking for a write-back', () => {
		const data = { profiles: [{ chats: [chat('0xa', peerData({ privateArmored: '' }))] }] }
		const { data: out, changed } = stripPeerChatPrivateArmored(data)
		expect(changed).toBe(false)
		expect('privateArmored' in (out.profiles as any[])[0].chats[0].chatData).toBe(false)
	})

	it('returns the same object when no chat has the key', () => {
		const data = { profiles: [{ chats: [chat('0xa', peerData()), chat('0xb', undefined)] }, { keyID: 'no chats' }] }
		const res = stripPeerChatPrivateArmored(data)
		expect(res.changed).toBe(false)
		expect(res.data).toBe(data)
	})

	it('handles nested profile arrays and every profile', () => {
		const data = {
			profiles: [
				[{ chats: [chat('0xa', peerData({ privateArmored: OWN_KEY }))] }],
				{ chats: [chat('0xb', peerData({ privateArmored: OWN_KEY }))] },
			],
		}
		const { data: out, changed } = stripPeerChatPrivateArmored(data)
		expect(changed).toBe(true)
		expect(JSON.stringify(out)).not.toContain('privateArmored')
	})

	it('ignores data without profiles', () => {
		expect(stripPeerChatPrivateArmored({} as any).changed).toBe(false)
		expect(stripPeerChatPrivateArmored({ profiles: null } as any).changed).toBe(false)
	})
})
