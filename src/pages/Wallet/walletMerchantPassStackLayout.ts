/** ~408:260 at typical wallet column width; stack math stays fixed-height. */
export const STACK_CARD_OVERLAP_PX = 140
export const STACK_CARD_H = 220
export const STACK_STEP_PX = STACK_CARD_H - STACK_CARD_OVERLAP_PX

export function stackLayoutHeight(count: number): number {
	if (count <= 0) return STACK_CARD_H
	return STACK_CARD_H + (count - 1) * STACK_STEP_PX
}

/** Cards above selected move up; cards below move down; selected stays anchored. */
export function stackCardExpandOffsetY(stackIdx: number, expandedIdx: number | null): number {
	if (expandedIdx === null || stackIdx === expandedIdx) return 0
	if (stackIdx < expandedIdx) return -(expandedIdx - stackIdx) * STACK_CARD_OVERLAP_PX
	return (stackIdx - expandedIdx) * STACK_CARD_OVERLAP_PX
}

export function stackLayoutHeightExpanded(count: number, expandedIdx: number | null): number {
	if (count <= 0) return STACK_CARD_H
	if (expandedIdx === null) return stackLayoutHeight(count)
	let maxBottom = 0
	for (let i = 0; i < count; i++) {
		const top = i * STACK_STEP_PX + stackCardExpandOffsetY(i, expandedIdx)
		maxBottom = Math.max(maxBottom, top + STACK_CARD_H)
	}
	return maxBottom
}
