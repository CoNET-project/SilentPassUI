import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

const TAP_MOVE_TOLERANCE_PX = 24

/**
 * Mobile-safe tap: fire on pointerup for touch/pen (avoids lost clicks from
 * global touchmove preventDefault / sticky :hover). Mouse/keyboard still use click.
 */
export function useReliableTapHandler(handler: () => void) {
	const handlerRef = useRef(handler)
	handlerRef.current = handler

	const pointerTapDoneRef = useRef(false)
	const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

	const run = useCallback(() => {
		handlerRef.current()
	}, [])

	const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
		pointerTapDoneRef.current = false
		pointerStartRef.current = { x: e.clientX, y: e.clientY }
		if (e.pointerType === 'touch') {
			try {
				e.currentTarget.setPointerCapture(e.pointerId)
			} catch {
				/* ignore */
			}
		}
	}, [])

	const onPointerUp = useCallback(
		(e: PointerEvent<HTMLElement>) => {
			if (pointerTapDoneRef.current) return
			const start = pointerStartRef.current
			pointerStartRef.current = null
			if (start) {
				const dx = e.clientX - start.x
				const dy = e.clientY - start.y
				if (dx * dx + dy * dy > TAP_MOVE_TOLERANCE_PX * TAP_MOVE_TOLERANCE_PX) return
			}
			if (e.pointerType === 'touch' || e.pointerType === 'pen') {
				pointerTapDoneRef.current = true
				e.preventDefault()
				run()
			}
		},
		[run]
	)

	const onClick = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			if (pointerTapDoneRef.current) {
				pointerTapDoneRef.current = false
				e.preventDefault()
				return
			}
			run()
		},
		[run]
	)

	return { onPointerDown, onPointerUp, onClick }
}

/** Shared className fragment for touch CTAs. */
export const RELIABLE_TAP_BUTTON_CLASS =
	'touch-manipulation select-none [-webkit-tap-highlight-color:transparent] cursor-pointer'
