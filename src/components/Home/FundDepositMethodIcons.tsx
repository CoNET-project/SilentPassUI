/** Brand marks for Home Fund / Deposit sheet rows. Decorative only. */

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

function PhantomGlyph() {
	return (
		<svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
			<rect width="32" height="32" rx="8" fill="#AB9FF2" />
			<path
				fill="#fff"
				d="M8.2 13.2c0-4.1 3.6-7.4 7.8-7.4s7.8 3.3 7.8 7.4v8.1c0 1.5-1.2 2.7-2.7 2.7h-1.1v-4.2c0-.7-.6-1.3-1.3-1.3h-5.4c-.7 0-1.3.6-1.3 1.3v4.2h-1.1c-1.5 0-2.7-1.2-2.7-2.7v-8.1Zm5.2-1.1c0-.9-.7-1.6-1.5-1.6s-1.5.7-1.5 1.6.7 1.6 1.5 1.6 1.5-.7 1.5-1.6Zm7.7 0c0-.9-.7-1.6-1.5-1.6s-1.5.7-1.5 1.6.7 1.6 1.5 1.6 1.5-.7 1.5-1.6Z"
			/>
		</svg>
	)
}

function MetaMaskGlyph() {
	return (
		<svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
			<rect width="32" height="32" rx="8" fill="#fff" />
			<path fill="#E2761B" d="M25.6 6.4 17.8 12l1.5-3.6 6.3-2Z" />
			<path fill="#E4761B" d="m6.4 6.4 7.7 5.7-1.4-3.7-6.3-2Z" />
			<path fill="#E4761B" d="M22.3 21.4 20.4 24.3l4 1.1.1-4.6-2.2.6Zm-12.8-3.6.1 4.6 4-1.1-1.9-2.9-2.2-.6Z" />
			<path fill="#D7C1B3" d="m12.5 23.2-.1-2.1-1.6.1 1.7 2Zm7.1 0 1.6-2-1.5-.1-.1 2.1Z" />
			<path fill="#233447" d="M20.4 24.3 18.8 25l.1-1.7.1-.1 1.4 1.1Zm-8.8 0 1.4-1.1.1.1.1 1.7-1.6-.7Z" />
			<path fill="#CD6116" d="m13.6 17.1-1.8.5 1.3 1.8.6-2.3Zm4.8 0 .6 2.3 1.3-1.8-1.9-.5Z" />
			<path fill="#E4751F" d="m9.6 17.8 2.2.6 1.9-2.9-3.1.6-1 .1.0 1.6Zm12.8 0-.1-1.6-1-.1-3.1-.6 1.8 2.9 2.4-.6Z" />
			<path fill="#F6851B" d="m20.4 24.3.1-1.7-1.4.1h-6.2l-1.4-.1.1 1.7 1.6.7 1.1-.8h3.6l1.1.8 1.4-.7Z" />
			<path fill="#C0AD9E" d="m18.8 25-.1-1.7h-5.4l-.1 1.7-1.1.8h7.8l-1.1-.8Z" />
			<path fill="#161616" d="m15.3 21.2-.6-1.3h-2.1l2.1 2.5.6-1.2Zm1.4 0 .6 1.2 2.1-2.5h-2.1l-.6 1.3Z" />
			<path fill="#763D16" d="M25.6 6.4 17.5 12.4l.8 3.3 1.8-.1 3.1.6.1 1.6 2.3-2.8Z" />
			<path fill="#763D16" d="M6.4 6.4 3.4 16.9l2.3 2.8.1-1.6 3.1-.6 1.8.1.8-3.3L6.4 6.4Z" />
			<path fill="#F6851B" d="m9.6 17.8 1.9 2.9v2.1l4-1.7.6 1.2-2.1 2.5 3 .1h.1l3-.1-2.1-2.5.6-1.2 4 1.7v-2.1l1.9-2.9-2.4.6-1.8 2.9-4-1.7h.1l-4 1.7-1.8-2.9-2.2-.6Z" />
		</svg>
	)
}

function OtherWalletsGlyph() {
	return (
		<svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
			<rect width="32" height="32" rx="8" fill="#111111" />
			<path
				fill="#fff"
				d="M10 10h5v5h-5V10Zm7 0h5v5h-5V10Zm-7 7h5v5h-5v-5Zm7 0h5v5h-5v-5Z"
			/>
		</svg>
	)
}

export function ReceiveWalletClusterMark() {
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			<span className="relative z-[3] overflow-hidden rounded-lg ring-2 ring-white dark:ring-slate-800">
				<PhantomGlyph />
			</span>
			<span className="relative z-[2] -ml-2 overflow-hidden rounded-lg ring-2 ring-white dark:ring-slate-800">
				<MetaMaskGlyph />
			</span>
			<span className="relative z-[1] -ml-2 overflow-hidden rounded-lg ring-2 ring-white dark:ring-slate-800">
				<OtherWalletsGlyph />
			</span>
		</span>
	)
}
