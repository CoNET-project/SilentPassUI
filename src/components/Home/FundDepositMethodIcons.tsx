/** Brand marks for Home Fund / Deposit sheet rows. Decorative only. */

const tileClass = 'block h-9 w-9 overflow-hidden rounded-[0.55rem]'

/** Official Phantom ghost on brand lavender (#AB9FF2). */
function PhantomOfficialMark({ className = tileClass }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden>
			<rect width="24" height="24" rx="5.5" fill="#AB9FF2" />
			<path
				fill="#fff"
				d="M5.893 18.4c2.042 0 3.576-1.706 4.492-3.054a2.5 2.5 0 0 0-.173.883c0 .787.47 1.348 1.398 1.348 1.275 0 2.636-1.074 3.341-2.23q-.075.25-.074.464c0 .55.322.895.978.895 2.066 0 4.145-3.52 4.145-6.597C20 7.711 18.738 5.6 15.57 5.6 10.002 5.6 4 12.137 4 16.36c0 1.658.928 2.04 1.893 2.04m7.759-8.553c0-.597.347-1.014.854-1.014.495 0 .841.417.841 1.014 0 .596-.346 1.026-.841 1.026-.508 0-.854-.43-.854-1.026m2.648 0c0-.597.347-1.014.854-1.014.495 0 .841.417.841 1.014 0 .596-.346 1.026-.841 1.026-.507 0-.854-.43-.854-1.026"
			/>
		</svg>
	)
}

/** Official MetaMask fox (cropped to fill the tile). */
function MetaMaskOfficialMark({ className = `${tileClass} bg-white` }: { className?: string }) {
	return (
		<svg viewBox="32 32 255 255" className={className} aria-hidden>
			<path fill="#e2761b" stroke="#e2761b" strokeLinecap="round" strokeLinejoin="round" d="m274.1 35.5-99.5 73.9L193 65.8z" />
			<path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m44.4 35.5 98.7 74.6-17.5-44.3zm193.9 171.3-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9L50.1 263l56.7-15.6-26.5-40.6z" />
			<path fill="#e4761b" stroke="#e4761b" strokeLinecap="round" strokeLinejoin="round" d="m103.6 138.2-15.8 23.9 56.3 2.5-2-60.5zm111.3 0-39-34.8-1.3 61.2 56.2-2.5zM106.8 247.4l33.8-16.5-29.2-22.8zm71.1-16.5 33.9 16.5-4.7-39.3z" />
			<path fill="#d7c1b3" stroke="#d7c1b3" strokeLinecap="round" strokeLinejoin="round" d="m211.8 247.4-33.9-16.5 2.7 22.1-.3 9.3zm-105 0 31.5 14.9-.2-9.3 2.5-22.1z" />
			<path fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round" d="m138.8 193.5-28.2-8.3 19.9-9.1zm40.9 0 8.3-17.4 20 9.1z" />
			<path fill="#cd6116" stroke="#cd6116" strokeLinecap="round" strokeLinejoin="round" d="m106.8 247.4 4.8-40.6-31.3.9zM207 206.8l4.8 40.6 26.5-39.7zm23.8-44.7-56.2 2.5 5.2 28.9 8.3-17.4 20 9.1zm-120.2 23.1 20-9.1 8.2 17.4 5.3-28.9-56.3-2.5z" />
			<path fill="#e4751f" stroke="#e4751f" strokeLinecap="round" strokeLinejoin="round" d="m87.8 162.1 23.6 46-.8-22.9zm120.3 23.1-1 22.9 23.7-46zm-64-20.6-5.3 28.9 6.6 34.1 1.5-44.9zm30.5 0-2.7 18 1.2 45 6.7-34.1z" />
			<path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m179.8 193.5-6.7 34.1 4.8 3.3 29.2-22.8 1-22.9zm-69.2-8.3.8 22.9 29.2 22.8 4.8-3.3-6.6-34.1z" />
			<path fill="#c0ad9e" stroke="#c0ad9e" strokeLinecap="round" strokeLinejoin="round" d="m180.3 262.3.3-9.3-2.5-2.2h-37.7l-2.3 2.2.2 9.3-31.5-14.9 11 9 22.3 15.5h38.3l22.4-15.5 11-9z" />
			<path fill="#161616" stroke="#161616" strokeLinecap="round" strokeLinejoin="round" d="m177.9 230.9-4.8-3.3h-27.7l-4.8 3.3-2.5 22.1 2.3-2.2h37.7l2.5 2.2z" />
			<path fill="#763d16" stroke="#763d16" strokeLinecap="round" strokeLinejoin="round" d="m278.3 114.2 8.5-40.8-12.7-37.9-96.2 71.4 37 31.3 52.3 15.3 11.6-13.5-5-3.6 8-7.3-6.2-4.8 8-6.1zM31.8 73.4l8.5 40.8-5.4 4 8 6.1-6.1 4.8 8 7.3-5 3.6 11.5 13.5 52.3-15.3 37-31.3-96.2-71.4z" />
			<path fill="#f6851b" stroke="#f6851b" strokeLinecap="round" strokeLinejoin="round" d="m267.2 153.5-52.3-15.3 15.9 23.9-23.7 46 31.2-.4h46.5zm-163.6-15.3-52.3 15.3-17.4 54.2h46.4l31.1.4-23.6-46zm71 26.4 3.3-57.7 15.2-41.1h-67.5l15 41.1 3.5 57.7 1.2 18.2.1 44.8h27.7l.2-44.8z" />
		</svg>
	)
}

/** Official OKX X on black rounded square. */
function OkxOfficialMark({ className = tileClass }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden>
			<rect width="24" height="24" rx="5.5" fill="#111111" />
			<path
				fill="#fff"
				d="M4 4h5.333v5.333H4zm10.667 5.333H9.333v5.334H4V20h5.333v-5.333h5.334V20H20v-5.333h-5.333zm0 0V4H20v5.333z"
			/>
		</svg>
	)
}

export function CoinbaseCMark({ className = 'h-9 w-9' }: { className?: string }) {
	return (
		<svg viewBox="0 0 36 36" className={`shrink-0 ${className}`} aria-hidden>
			<circle cx="18" cy="18" r="18" fill="#0052FF" />
			<path
				fill="#fff"
				d="M18 8.4c5.3 0 9.6 4.3 9.6 9.6s-4.3 9.6-9.6 9.6-9.6-4.3-9.6-9.6 4.3-9.6 9.6-9.6Zm0 5.1c-2.48 0-4.5 2.02-4.5 4.5s2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5-2.02-4.5-4.5-4.5Z"
			/>
			<rect x="16.05" y="16.2" width="7.7" height="3.6" fill="#0052FF" />
		</svg>
	)
}

export function VisaMastercardMark({ className = 'h-8' }: { className?: string }) {
	return (
		<span className={`relative inline-flex w-[3.85rem] shrink-0 items-center ${className}`} aria-hidden>
			<span className="flex h-7 w-[2.55rem] items-center justify-center rounded-[5px] bg-[#1A1F71] text-[8px] font-extrabold tracking-[0.04em] text-white">
				VISA
			</span>
			<svg viewBox="0 0 36 24" className="absolute -right-0.5 h-7 w-9" aria-hidden>
				<rect width="36" height="24" rx="5" fill="#fff" />
				<circle cx="14.2" cy="12" r="7.2" fill="#EB001B" />
				<circle cx="21.8" cy="12" r="7.2" fill="#F79E1B" />
				<path
					fill="#FF5F00"
					d="M18 6.55a7.2 7.2 0 0 0 0 10.9 7.2 7.2 0 0 0 0-10.9Z"
				/>
			</svg>
		</span>
	)
}

/** Official TokenPocket mark (blue tile + white wordmark). */
function TokenPocketOfficialMark({ className = tileClass }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden>
			<rect width="24" height="24" rx="5.5" fill="#2980FE" />
			<path
				fill="#fff"
				d="M14.984 10.936h-3.175v5.773c0 .272.217.491.487.491h2.194a.487.487 0 0 0 .486-.49v-5.774zM10.274 6.8H4.487A.49.49 0 0 0 4 7.29v2c0 .272.217.491.487.491H6.35v6.928c0 .272.217.491.487.491h2.081c.27 0 .487-.219.487-.49V9.78h.853c.816 0 1.483-.672 1.483-1.494A1.46 1.46 0 0 0 10.274 6.8"
			/>
			<path
				fill="#fff"
				d="M15.912 6.8c-2.261 0-4.103 1.85-4.103 4.136a4.13 4.13 0 0 0 3.175 4.03v-4.03c0-.513.411-.928.92-.928s.922.415.922.928a.93.93 0 0 1-.929.928v3.2c.082 0 .157 0 .24-.007C18.293 14.928 20 13.132 20 10.928A4.097 4.097 0 0 0 15.912 6.8"
			/>
		</svg>
	)
}

const listTileClass = 'block h-10 w-10 overflow-hidden rounded-[0.7rem]'

/** Official app icon for a Receive-from-wallet catalog brand. */
export function ReceiveWalletBrandMark({
	brandId,
	className = listTileClass,
}: {
	brandId: string
	className?: string
}) {
	switch (brandId) {
		case 'metamask':
			return <MetaMaskOfficialMark className={`${className} bg-white`} />
		case 'phantom':
			return <PhantomOfficialMark className={className} />
		case 'okx':
			return <OkxOfficialMark className={className} />
		case 'base':
			return <CoinbaseCMark className={className} />
		case 'tp':
			return <TokenPocketOfficialMark className={className} />
		default:
			return null
	}
}

export function ReceiveWalletRowIcon({
	brandId,
	iconUrl,
	brandLetter,
	brandBg,
	brandFg,
}: {
	brandId: string
	iconUrl?: string
	brandLetter: string
	brandBg: string
	brandFg: string
}) {
	if (brandId === 'metamask' || brandId === 'phantom' || brandId === 'okx' || brandId === 'base' || brandId === 'tp') {
		return <ReceiveWalletBrandMark brandId={brandId} />
	}
	if (iconUrl) {
		return (
			<span className="h-10 w-10 shrink-0 overflow-hidden rounded-[0.7rem] bg-white">
				<img src={iconUrl} alt="" className="h-full w-full object-contain" />
			</span>
		)
	}
	return (
		<span
			className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] text-sm font-bold"
			style={{ backgroundColor: brandBg, color: brandFg }}
			aria-hidden
		>
			{brandLetter}
		</span>
	)
}

export function ReceiveWalletClusterMark() {
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			<span className="relative z-[3] rounded-[0.55rem] ring-2 ring-white dark:ring-slate-800">
				<PhantomOfficialMark />
			</span>
			<span className="relative z-[2] -ml-2.5 rounded-[0.55rem] bg-white ring-2 ring-white dark:bg-slate-800 dark:ring-slate-800">
				<MetaMaskOfficialMark />
			</span>
			<span className="relative z-[1] -ml-2.5 rounded-[0.55rem] ring-2 ring-white dark:ring-slate-800">
				<OkxOfficialMark />
			</span>
		</span>
	)
}
