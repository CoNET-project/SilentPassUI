import { useCallback, useState } from 'react'
import { Check, Copy, ExternalLink, Hexagon, Wallet } from 'lucide-react'
import { beamioWalletAccent, type BeamioWalletKind } from '@/utils/beamioWalletAccent'

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const basescanAddressUrl = (address: string) => `https://basescan.org/address/${address}`

function formatUsdcBalance(value: number | string): string {
	const n = Math.max(0, Number(value) || 0)
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ProfileWalletAddressCopy({
	address,
	actionIconClass,
}: {
	address: string
	actionIconClass: string
}) {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(async () => {
		if (!address || address.length < 10) return
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// ignore
		}
	}, [address])

	return (
		<button
			type="button"
			onClick={handleCopy}
			className={`inline-flex shrink-0 items-center justify-center active:opacity-70 ${actionIconClass}`}
			aria-label="Copy address"
			title="Copy address"
		>
			{copied ? (
				<Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.25} />
			) : (
				<Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
			)}
		</button>
	)
}

function ProfileWalletBaseScanButton({
	address,
	actionIconClass,
}: {
	address: string
	actionIconClass: string
}) {
	return (
		<a
			href={basescanAddressUrl(address)}
			target="_blank"
			rel="noopener noreferrer"
			className={`inline-flex shrink-0 items-center justify-center active:opacity-70 ${actionIconClass}`}
			aria-label="View on BaseScan"
			title="View on BaseScan"
		>
			<ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
		</a>
	)
}

function ProfileWalletPanelCard({
	kind,
	address,
	balanceUsdc,
}: {
	kind: BeamioWalletKind
	address: string
	balanceUsdc: number | string
}) {
	const accent = beamioWalletAccent(kind)
	const title = kind === 'aa' ? 'Smart Wallet' : 'Wallet'
	const kindBadge = kind === 'aa' ? 'AA' : 'EOA'
	const hasAddress = Boolean(address && address.length >= 10)

	return (
		<div
			className="rounded-[22px] border bg-white px-5 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]"
			style={{ borderColor: accent.border }}
		>
			<div className="flex items-start gap-3">
				<div
					className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${accent.iconBgClass} ${accent.iconShadowClass}`}
				>
					{kind === 'aa' ? (
						<Hexagon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					) : (
						<Wallet className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					)}
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<div className="text-[17px] font-bold leading-tight text-slate-900">{title}</div>
							<div className="mt-1 flex min-w-0 items-center gap-1.5">
								<span className="truncate font-mono text-[13px] text-slate-500">
									{hasAddress ? fmtAddr(address) : 'Unavailable'}
								</span>
								{hasAddress ? (
									<>
										<ProfileWalletAddressCopy address={address} actionIconClass={accent.actionIconClass} />
										<ProfileWalletBaseScanButton address={address} actionIconClass={accent.actionIconClass} />
									</>
								) : null}
							</div>
						</div>
						<span
							className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold ${accent.badgeBorderClass} ${accent.badgeBgClass} ${accent.badgeTextClass}`}
						>
							{kindBadge}
						</span>
					</div>
				</div>
			</div>

			<div className="mt-4 border-t border-slate-100 pt-3">
				<div className="text-[11px] font-medium text-slate-400">Balance</div>
				<div className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">
					{formatUsdcBalance(balanceUsdc)}{' '}
					<span className="text-[17px] font-bold text-slate-900">USDC</span>
				</div>
			</div>
		</div>
	)
}

export function ProfileWalletPanels({
	eoaAddress,
	aaAddress,
	eoaBalanceUsdc,
	aaBalanceUsdc,
}: {
	eoaAddress: string
	aaAddress: string
	eoaBalanceUsdc: number | string
	aaBalanceUsdc: number | string
}) {
	return (
		<div className="mb-5 flex flex-col gap-4">
			<ProfileWalletPanelCard kind="aa" address={aaAddress} balanceUsdc={aaBalanceUsdc} />
			<ProfileWalletPanelCard kind="eoa" address={eoaAddress} balanceUsdc={eoaBalanceUsdc} />
		</div>
	)
}
