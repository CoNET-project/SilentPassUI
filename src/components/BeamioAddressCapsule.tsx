import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** `0x1234…5678`: first 6 + … + last 4 (address-capsule-ui rule). */
export const shortAddressLabel = (address: string): string => {
	const raw = String(address || '').trim()
	return raw.length > 12 ? `${raw.slice(0, 6)}…${raw.slice(-4)}` : raw
}

/**
 * Address capsule: short address plus a copy icon. Tapping copies the FULL
 * address; the icon turns into a green check for about 2 s.
 */
export function BeamioAddressCapsule({
	address,
	className = 'border-[#dce2f7] bg-[#e9edff] text-[#424655]',
	iconClassName = 'text-[#727687]',
	leading,
}: {
	address: string
	className?: string
	iconClassName?: string
	/** Optional icon before the address (e.g. a wallet glyph). */
	leading?: React.ReactNode
}) {
	const full = String(address || '').trim()
	const [copied, setCopied] = useState(false)
	const timer = useRef<number | undefined>(undefined)
	useEffect(() => () => window.clearTimeout(timer.current), [])
	const copy = useCallback(async (event: React.MouseEvent) => {
		event.stopPropagation()
		try {
			await navigator.clipboard.writeText(full)
			setCopied(true)
			window.clearTimeout(timer.current)
			timer.current = window.setTimeout(() => setCopied(false), 2000)
		} catch {
			setCopied(false)
		}
	}, [full])
	if (!full) return null
	return (
		<button
			type="button"
			onClick={(event) => void copy(event)}
			className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] ${className}`}
			aria-label={`Copy address ${full}`}
			title={full}
		>
			{leading}
			<span className="truncate">{shortAddressLabel(full)}</span>
			{copied
				? <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
				: <Copy className={`h-3 w-3 shrink-0 ${iconClassName}`} aria-hidden />}
		</button>
	)
}
