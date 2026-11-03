/**
 * Attributes for message inputs (1:1 chat, group chat; the call page reuses
 * the 1:1 composer) so iOS does not offer saved passwords above the keyboard.
 *
 * With a beamio.app password in iCloud Keychain, iOS showed "Passwords for
 * beamio.app" on the chat textarea; Return could pick it, Face ID followed and
 * the draft was cleared. `autocomplete="off"` gives WebKit no text content
 * type, and an untyped field is left to Apple's heuristics (Apple: "If you
 * haven't tagged the input field, the system uses heuristics"). WebKit maps
 * `one-time-code` to UITextContentTypeOneTimeCode, the usual native way to
 * keep the Passwords bar off a field. Side effect: right after an SMS code
 * arrives, iOS may offer that code instead (tap-only, never inserted alone).
 *
 * Verified 2026-11-02 on an iPhone with a saved beamio.app password (QA build
 * v3rc3): no Passwords bar on the chat input.
 */
export const COMPOSER_AUTOCOMPLETE = 'one-time-code'

/** Spread onto a message <textarea>. `name` avoids user/login/email words that credential heuristics look for. */
export function chatComposerAutofillProps(name = 'beamio-chat-message'): {
	autoComplete: string
	name: string
	'data-1p-ignore': string
	'data-lpignore': string
	'data-form-type': string
} {
	return {
		autoComplete: COMPOSER_AUTOCOMPLETE,
		name,
		// Third-party password managers (1Password, LastPass, Dashlane) skip these.
		'data-1p-ignore': 'true',
		'data-lpignore': 'true',
		'data-form-type': 'other',
	}
}
