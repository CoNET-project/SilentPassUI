/**
 * Address capsule: short address + copy (full address). Optional explorer via openExternalUrl.
 * @see address-capsule-ui.mdc, beamio-native-external-url-bridge.mdc
 */
import React, { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { openExternalUrl } from '@/utils/openExternalUrl'

function shortAddress(address: string): string {
	const a = String(address ?? '').trim()
	if (!a || a.length < 10) return a || '—'
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export type AddressCapsuleProps = {
	address: string
	className?: string
	leadingIcon?: React.ReactNode
	/** When set, address opens explorer (system browser / window.open via helper). */
	explorerUrl?: string | null
}

export function AddressCapsule({
	address,
	className = '',
	leadingIcon,
	explorerUrl,
}: AddressCapsuleProps) {
	const [copied, setCopied] = useState(false)
	const short = shortAddress(address)

	const handleCopy = useCallback(async () => {
		const full = String(address ?? '').trim()
		if (!full || full.length < 10) return
		try {
			await navigator.clipboard.writeText(full)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			// ignore
		}
	}, [address])

	const shellClass = `inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full font-mono text-[11px] font-semibold border transition-colors ${className}`

	if (explorerUrl) {
		return (
			<div className={shellClass}>
				{leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
				<button
					type="button"
					onClick={() => openExternalUrl(explorerUrl)}
					className="min-w-0 truncate hover:underline"
					aria-label={`Open address ${address} in explorer`}
				>
					{short}
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						void handleCopy()
					}}
					className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
					aria-label="Copy address"
					title="Copy address"
				>
					{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
				</button>
			</div>
		)
	}

	return (
		<button
			type="button"
			onClick={() => void handleCopy()}
			className={shellClass}
			title="Copy address"
			aria-label={`Copy address ${address}`}
		>
			{leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
			<span className="truncate">{short}</span>
			{copied ? (
				<Check size={12} className="shrink-0 text-emerald-500" />
			) : (
				<Copy size={12} className="shrink-0 opacity-70 hover:opacity-100" />
			)}
		</button>
	)
}
