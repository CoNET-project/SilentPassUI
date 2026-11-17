/**
 * 0.52.935 restricted Android chat channel. Ported from the R763 tests (54395114, eac98129, 03b2d506) with the child-frame rule
 * added. SYNTHETIC values only. No native-keys gate is tested here: that gate is not carried over.
 */
import { publishNativePwaLog } from './cashTreesNativePwaLog'
import {
	androidChatChannelKind,
	androidChatModulePresent,
	installBeamioChatReceiver,
	isChatChannelFailure,
	postAndroidChatCommand,
	postAndroidSignResponse,
} from './androidChatChannel'

jest.mock('./cashTreesNativePwaLog', () => ({
	publishNativePwaLog: jest.fn(),
}))

const w = window as unknown as { BeamioChat?: unknown; CashTreesAndroid?: unknown; top?: unknown }
const realTop = window.top

function setTop(value: unknown) {
	Object.defineProperty(window, 'top', { value, configurable: true })
}

afterEach(() => {
	delete w.BeamioChat
	delete w.CashTreesAndroid
	setTop(realTop)
	;(publishNativePwaLog as jest.Mock).mockReset()
})

describe('channel selection (top frame)', () => {
	it('top frame with window.BeamioChat: the new channel is used', () => {
		w.BeamioChat = { postMessage: jest.fn() }
		expect(androidChatChannelKind()).toBe('beamio')
		expect(androidChatModulePresent()).toBe(true)
	})

	it('no BeamioChat, CashTreesAndroid.chatModuleCommand present: the legacy channel is used', () => {
		w.CashTreesAndroid = { chatModuleCommand: jest.fn() }
		expect(androidChatChannelKind()).toBe('legacy')
	})

	it('neither: none', () => {
		expect(androidChatChannelKind()).toBe('none')
		expect(androidChatModulePresent()).toBe(false)
	})
})

describe('child frame never uses window.BeamioChat', () => {
	it('child frame with BeamioChat: kind is not beamio, commands are not sent to it', () => {
		setTop({}) // a different window object: this is a child frame
		const postMessage = jest.fn()
		w.BeamioChat = { postMessage }
		expect(androidChatChannelKind()).toBe('none')
		expect(postAndroidChatCommand({ type: 'walletStatus', reqId: 1 })).toBe(false)
		expect(postAndroidSignResponse({ reqId: 1, ok: true })).toBe(false)
		expect(postMessage).not.toHaveBeenCalled()
	})

	it('child frame: the receiver is not installed on BeamioChat', () => {
		setTop({})
		const host: { postMessage?: unknown; onmessage?: unknown } = { postMessage: jest.fn() }
		w.BeamioChat = host
		expect(installBeamioChatReceiver()).toBeNull()
		expect(host.onmessage).toBeUndefined()
	})

	it('cross-origin window.top (access throws): not trusted', () => {
		Object.defineProperty(window, 'top', {
			configurable: true,
			get() {
				throw new Error('SecurityError')
			},
		})
		w.BeamioChat = { postMessage: jest.fn() }
		expect(androidChatChannelKind()).toBe('none')
	})

	it('child frame with legacy CashTreesAndroid: the 0.52.933 legacy path is unchanged', () => {
		setTop({})
		const legacy = { chatModuleCommand: jest.fn() }
		w.CashTreesAndroid = legacy
		expect(androidChatChannelKind()).toBe('legacy')
		expect(postAndroidChatCommand({ type: 'walletStatus', reqId: 2 })).toBe(true)
		expect(legacy.chatModuleCommand).toHaveBeenCalledWith(JSON.stringify({ type: 'walletStatus', reqId: 2 }))
	})
})

describe('commands and sign answers (top frame, BeamioChat)', () => {
	it('command is sent as a JSON string; the legacy method is not called', () => {
		const postMessage = jest.fn()
		const legacy = { chatModuleCommand: jest.fn() }
		w.BeamioChat = { postMessage }
		w.CashTreesAndroid = legacy
		const cmd = { type: 'walletStatus', reqId: 7 }
		expect(postAndroidChatCommand(cmd)).toBe(true)
		expect(postMessage).toHaveBeenCalledTimes(1)
		expect(postMessage).toHaveBeenCalledWith(JSON.stringify(cmd))
		expect(legacy.chatModuleCommand).not.toHaveBeenCalled()
	})

	it('sign answer is sent as a JSON string (eac98129: a non-string is answered bad_request by the shell)', () => {
		const postMessage = jest.fn()
		w.BeamioChat = { postMessage }
		expect(postAndroidSignResponse({ reqId: 9, ok: true, signature: '0xabc' })).toBe(true)
		expect(postMessage).toHaveBeenCalledWith(
			JSON.stringify({ type: 'chatModuleSignResponse', reqId: 9, ok: true, signature: '0xabc' }),
		)
	})

	it('BeamioChat without postMessage: nothing is sent and the legacy method is not used', () => {
		const legacy = { chatModuleCommand: jest.fn() }
		w.BeamioChat = {}
		w.CashTreesAndroid = legacy
		expect(postAndroidChatCommand({ type: 'walletStatus', reqId: 1 })).toBe(false)
		expect(legacy.chatModuleCommand).not.toHaveBeenCalled()
	})

	it('legacy only: the command goes to chatModuleCommand as before', () => {
		const legacy = { chatModuleCommand: jest.fn() }
		w.CashTreesAndroid = legacy
		expect(postAndroidChatCommand({ type: 'walletStatus', reqId: 3 })).toBe(true)
		expect(legacy.chatModuleCommand).toHaveBeenCalledWith(JSON.stringify({ type: 'walletStatus', reqId: 3 }))
	})

	it('no channel at all: nothing is sent', () => {
		expect(postAndroidChatCommand({ type: 'walletStatus', reqId: 4 })).toBe(false)
	})
})

describe('receiving and failures', () => {
	it('JSON string from the shell is parsed and dispatched as the cashtreesandroid event', () => {
		const host: { onmessage?: ((ev: unknown) => void) | null } = {}
		w.BeamioChat = host
		const remove = installBeamioChatReceiver()
		expect(remove).toBeInstanceOf(Function)
		const seen: unknown[] = []
		const listener = (ev: Event) => seen.push((ev as CustomEvent).detail)
		window.addEventListener('cashtreesandroid', listener)
		host.onmessage?.({ data: JSON.stringify({ type: 'chatModuleEvent', event: 'ready' }) })
		window.removeEventListener('cashtreesandroid', listener)
		expect(seen).toEqual([{ type: 'chatModuleEvent', event: 'ready' }])
		remove?.()
	})

	it('a non-JSON message is dropped', () => {
		const host: { onmessage?: ((ev: unknown) => void) | null } = {}
		w.BeamioChat = host
		installBeamioChatReceiver()
		const seen: unknown[] = []
		const listener = (ev: Event) => seen.push((ev as CustomEvent).detail)
		window.addEventListener('cashtreesandroid', listener)
		host.onmessage?.({ data: 'not json {' })
		window.removeEventListener('cashtreesandroid', listener)
		expect(seen).toEqual([])
	})

	it('origin_refused is a failure; only its code is logged', () => {
		expect(isChatChannelFailure({ type: 'ack', ok: true, error: 'origin_refused' })).toBe(true)
		expect(isChatChannelFailure({ type: 'ack', ok: true })).toBe(false)
		const host: { onmessage?: ((ev: unknown) => void) | null } = {}
		w.BeamioChat = host
		installBeamioChatReceiver()
		host.onmessage?.({ data: JSON.stringify({ type: 'ack', ok: false, error: 'origin_refused', secret: 'x' }) })
		expect(publishNativePwaLog).toHaveBeenCalledWith('info', '[chatChannel] answer refused: origin_refused')
		expect((publishNativePwaLog as jest.Mock).mock.calls.flat().join(' ')).not.toContain('secret')
	})
})

describe('170 Release bridge shape (no chatModuleCommand, no conetChatInit, BeamioChat present)', () => {
	it('the new channel is the only one, so the page never falls back to the legacy listen-only init', () => {
		w.CashTreesAndroid = { getEmbeddedPwaVersion: () => '0.52.933' } // shell object without chatModuleCommand/conetChatInit
		w.BeamioChat = { postMessage: jest.fn() }
		expect(androidChatChannelKind()).toBe('beamio')
		expect(androidChatModulePresent()).toBe(true)
	})
})
