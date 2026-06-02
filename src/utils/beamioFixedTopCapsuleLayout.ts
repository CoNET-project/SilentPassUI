import type { CSSProperties } from 'react'

/**
 * 固定顶栏胶囊与滚动区顶占位 — 与 Home.tsx 内联样式同源。
 * 全项目守则：beamio-fixed-top-capsule-protocol.mdc
 */
export const BEAMIO_FIXED_CAPSULE_TOP = 'max(1rem, env(safe-area-inset-top, 0px))'

export const BEAMIO_FIXED_CAPSULE_SCROLL_TOP_SPACER = `calc(${BEAMIO_FIXED_CAPSULE_TOP} + 5rem)`

export function beamioFixedCapsuleTopStyle(): CSSProperties {
	return { top: BEAMIO_FIXED_CAPSULE_TOP }
}

export function beamioFixedCapsuleScrollTopSpacerStyle(): CSSProperties {
	return { minHeight: BEAMIO_FIXED_CAPSULE_SCROLL_TOP_SPACER }
}
