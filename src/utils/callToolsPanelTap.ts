/**
 * Call tools panel over peer video: a tap on the panel itself (name, timer,
 * address, the gaps between buttons) collapses it, the same as the grabber.
 * A tap on a control (or anything inside one, such as its icon or label)
 * only runs that control.
 */
const CONTROL_SELECTOR = 'button, a, input, select, textarea, [role="button"]'

export function isCallToolsPanelBackgroundTap(
	target: EventTarget | null,
	panel: Element | null,
): boolean {
	if (!panel || !target || typeof (target as Node).nodeType !== 'number') return false
	const node = target as Node
	if (!panel.contains(node)) return false
	let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement
	while (el && el !== panel) {
		if (el.matches(CONTROL_SELECTOR)) return false
		el = el.parentElement
	}
	return true
}
