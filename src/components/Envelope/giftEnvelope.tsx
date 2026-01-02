type GiftEnvelopeOpts = {
	size?: number
	stroke?: string
	fill?: string
	strokeWidth?: number
	radius?: number
}

export function giftEnvelope(opts: GiftEnvelopeOpts = {}) {
	const {
		size = 24,
		stroke = "currentColor",
		fill = "none",
		strokeWidth = 1.8,
		radius = 2.5
	} = opts

	// 返回 SVG 字符串：红包/信封 + 礼物蝴蝶结
	return `
<svg
	xmlns="http://www.w3.org/2000/svg"
	width="${size}"
	height="${size}"
	viewBox="0 0 24 24"
	fill="${fill}"
	stroke="${stroke}"
	stroke-width="${strokeWidth}"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<!-- envelope body -->
	<rect x="4" y="8.5" width="16" height="11" rx="${radius}" />
	<!-- envelope flap -->
	<path d="M4.8 9.2 12 14.2 19.2 9.2" />
	<!-- inner fold -->
	<path d="M4.8 18.6 10.6 13.9" />
	<path d="M19.2 18.6 13.4 13.9" />

	<!-- ribbon vertical -->
	<path d="M12 8.5v11" />
	<!-- ribbon horizontal (on envelope top edge) -->
	<path d="M4 12.2h16" />

	<!-- bow -->
	<path d="M12 7.2c0-1.2.9-2.2 2.1-2.2 1.3 0 2.5 1.1 2.5 2.3 0 1.2-1.1 2.2-2.7 2.2H12" />
	<path d="M12 7.2c0-1.2-.9-2.2-2.1-2.2-1.3 0-2.5 1.1-2.5 2.3 0 1.2 1.1 2.2 2.7 2.2H12" />
	<path d="M12 9.5v-3" />
</svg>`.trim()
}
