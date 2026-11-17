/**
 * Isolated reproduction of the 170 Release bridge shape for the Android chat client (0.52.935).
 * Shape: CashTreesAndroid is present (shell object) but has no chatModuleCommand and no conetChatInit; window.BeamioChat is
 * present in the top frame. Positive control: the legacy conetChatInit entry point. SYNTHETIC values only.
 */
import { createAndroidNativeChatClient } from './androidNativeChatClient'

// The chat-sdk import chain (openpgp via createRequire) does not load under this jest setup. The stub below records what the
// adapter sends to the bridge; the legacy listen path under test does not use the transport at all.
jest.mock('./nativeConetChatTransport', () => ({
	createNativeConetChatClient: (_config: unknown, bridge: { postCommand: (c: Record<string, unknown>) => void }) => ({
		init: () => {
			bridge.postCommand({ type: 'hello', reqId: 0, protocolVersion: 1 })
			return new Promise(() => undefined) // waits for the module's reply, which never comes in the stub
		},
		hello: () => null,
	}),
	type: undefined,
}))

const w = window as unknown as { BeamioChat?: unknown; CashTreesAndroid?: unknown }

const config = {
	identity: {
		privateKeyHex: '0x' + '11'.repeat(32),
		eoaAddress: '0x' + '22'.repeat(20),
		ownRouteArmoredPublicKey: '',
		pgpPrivateKeyArmored: '',
		pgpPublicKeyArmored: '',
		pgpPassphrase: '',
	},
	getNodes: async () => [],
} as never

afterEach(() => {
	delete w.BeamioChat
	delete w.CashTreesAndroid
})

/** Result of init() within 50 ms: 'resolved', 'rejected:<message>' or 'pending' (waiting for the module's reply). */
async function initOutcome(client: { init(): Promise<void> }): Promise<string> {
	const p = client.init().then(
		() => 'resolved',
		(e: Error) => `rejected:${e.message}`,
	)
	return Promise.race([p, new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50))])
}

describe('170 Release shape: BeamioChat present, no chatModuleCommand, no conetChatInit', () => {
	it('init does not refuse with conetChatInit and the page talks to BeamioChat', async () => {
		const postMessage = jest.fn()
		w.BeamioChat = { postMessage }
		w.CashTreesAndroid = { getEmbeddedPwaVersion: () => '0.52.933' }
		const client = createAndroidNativeChatClient(config as never)
		const outcome = await initOutcome(client as never)
		expect(outcome).not.toContain('conetChatInit refused')
		expect(postMessage).toHaveBeenCalled()
		const first = JSON.parse(postMessage.mock.calls[0][0] as string) as { type?: string }
		expect(typeof first.type).toBe('string')
		// Print the outcome for the evidence file (no payload content).
		// eslint-disable-next-line no-console
		console.log(`REPRO170 outcome=${outcome} firstCommandType=${first.type} posts=${postMessage.mock.calls.length}`)
	})
})

describe('positive control: legacy conetChatInit entry point', () => {
	it('CashTreesAndroid.conetChatInit returning true: init resolves on the legacy path', async () => {
		w.CashTreesAndroid = { conetChatInit: jest.fn(() => true), getEmbeddedPwaVersion: () => '0.52.933' }
		const client = createAndroidNativeChatClient(config as never)
		const outcome = await initOutcome(client as never)
		expect(outcome).toBe('resolved')
		// eslint-disable-next-line no-console
		console.log(`CONTROL legacy outcome=${outcome}`)
	})
})
