import { chatComposerAutofillProps, COMPOSER_AUTOCOMPLETE } from './chatComposerAutofill'

test('message inputs use one-time-code, never "off" or a credential token', () => {
	expect(COMPOSER_AUTOCOMPLETE).toBe('one-time-code')
	const props = chatComposerAutofillProps()
	expect(props.autoComplete).toBe('one-time-code')
	expect(props.name).toBe('beamio-chat-message')
	expect(props.name).not.toMatch(/user|login|email|pass/i)
	expect(props['data-1p-ignore']).toBe('true')
})

test('no localStorage switch changes the token', () => {
	window.localStorage.setItem('beamio_qa_composer_autocomplete', 'nickname')
	expect(chatComposerAutofillProps('beamio-group-message')).toMatchObject({ autoComplete: 'one-time-code', name: 'beamio-group-message' })
	window.localStorage.removeItem('beamio_qa_composer_autocomplete')
})
