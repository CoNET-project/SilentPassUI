import { KEYBOARD_MIN_COVER_PX, visualViewportFrameFor } from './useVisualViewportFrame'

test('no keyboard: the page keeps its own full-screen layout', () => {
	expect(visualViewportFrameFor(844, { height: 844, offsetTop: 0 })).toBeNull()
	// Small differences (toolbars, rounding) are not a keyboard.
	expect(visualViewportFrameFor(844, { height: 844 - KEYBOARD_MIN_COVER_PX + 1, offsetTop: 0 })).toBeNull()
})

test('iOS keyboard: the frame follows the panned visual viewport', () => {
	// WebKit panned the visual viewport down by 336 px to reveal the composer.
	expect(visualViewportFrameFor(844, { height: 508.4, offsetTop: 335.6 })).toEqual({ top: 336, height: 508 })
})

test('missing sizes are ignored', () => {
	expect(visualViewportFrameFor(0, { height: 500, offsetTop: 0 })).toBeNull()
	expect(visualViewportFrameFor(844, { height: 0, offsetTop: 0 })).toBeNull()
})
