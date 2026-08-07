import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Gift, Loader2 } from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { claimReferralRedeemCode } from '@/services/referralRegistryRedeem'
import type { ReferralRegistryRoleSnapshot } from '@/services/referralRegistryRole'

export default function ReferralRedeemClaimSheet({
	snapshot,
	privateKeyArmor,
	setShowFooter,
	onClose,
	onClaimed,
}: {
	snapshot: ReferralRegistryRoleSnapshot
	privateKeyArmor: string
	setShowFooter: (show: boolean) => void
	onClose: () => void
	onClaimed: () => void
}) {
	const [secret, setSecret] = useState('')
	const [isClaiming, setIsClaiming] = useState(false)
	const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle')
	const [message, setMessage] = useState('')

	useEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [setShowFooter])

	const handleClaim = useCallback(async () => {
		if (isClaiming) return
		setIsClaiming(true)
		setResult('idle')
		setMessage('')
		try {
			await claimReferralRedeemCode({ secret, privateKeyArmor })
			setSecret('')
			setResult('success')
			setMessage('Your wallet is now registered from the redeem code.')
			onClaimed()
		} catch (cause) {
			setResult('error')
			setMessage(cause instanceof Error ? cause.message : 'Could not claim this redeem code.')
		} finally {
			setIsClaiming(false)
		}
	}, [isClaiming, secret, privateKeyArmor, onClaimed])

	return (
		<div className="fixed inset-0 z-[100] bg-slate-950/50" role="dialog" aria-modal="true" aria-labelledby="referral-redeem-claim-title">
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Close claim panel" tabIndex={-1} />
			<section className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-[#071126] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-4 text-slate-50 shadow-[0_-16px_50px_rgba(2,6,23,0.35)] animate-in slide-in-from-bottom duration-300">
				<div className="mx-auto w-full max-w-xl">
					<div className="flex items-center justify-between">
						<BeamioCircularBackButton variant="onDark" onClick={onClose} />
						<div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/20 bg-indigo-300/10 text-indigo-200" aria-hidden>
							<Gift className="h-4 w-4" />
						</div>
					</div>
					<header className="pb-5 pt-5">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Referral registration</p>
						<h2 id="referral-redeem-claim-title" className="mt-2 text-2xl font-semibold tracking-tight">Claim a redeem code</h2>
						<p className="mt-2 text-sm leading-6 text-slate-400">Enter a code to register this wallet. Only the code hash is checked on CoNET.</p>
					</header>

					<label htmlFor="referral-redeem-secret" className="mt-4 block text-sm font-semibold text-white">Redeem code</label>
					<input
						id="referral-redeem-secret"
						type="text"
						autoComplete="off"
						value={secret}
						onChange={(event) => setSecret(event.target.value)}
						placeholder="beamio-l0-… / beamio-l1-… / beamio-admin-pkg-…"
						disabled={isClaiming}
						className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-3 font-mono text-sm text-white outline-none focus:border-indigo-300/70 disabled:opacity-60"
					/>
					<p className="mt-2 text-xs text-slate-500">Code length: {secret.length} characters</p>

					<button
						type="button"
						onClick={() => void handleClaim()}
						disabled={isClaiming || !secret.trim() || !privateKeyArmor}
						aria-busy={isClaiming}
						className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isClaiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
						{isClaiming ? 'Claiming code…' : 'Claim redeem code'}
					</button>

					{result !== 'idle' ? (
						<div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${result === 'success' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/20 bg-amber-400/10 text-amber-100'}`}>
							{result === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
							<span>{message}</span>
						</div>
					) : null}

					<div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
						{snapshot.eoa}
					</div>
				</div>
			</section>
		</div>
	)
}
