import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import BusinessIdentityForm, { type BusinessIdentitySuccess } from '@/pages/Home/BusinessIdentityForm'
import { AddressCapsule } from '@/components/AddressCapsule'
import { useTu } from '@/locale/beamioLocale'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useUnlockMerchantWorkspaceDeps } from '@/hooks/useUnlockMerchantWorkspaceDeps'
import { unlockMerchantWorkspaceSession } from '@/utils/unlockMerchantWorkspaceSession'
import {
	clearAgentCardClaimHandoff,
	peekAgentCardClaimHandoff,
	type AgentCardClaimHandoff,
} from '@/utils/agentCardClaimHandoff'
import {
	runAgentCardClaim,
	type AgentCardClaimProgress,
} from '@/utils/runAgentCardClaim'
import { setCoNET_Data } from '@/utils/globals'
import { setBizWorkspaceRole } from '@/utils/agentWorkspaceLocal'
import { bizBrandOnboardingPrimaryBtnClass } from '@/pages/Home/brandUi'

type Phase = 'create' | 'processing' | 'success' | 'error'

const PROGRESS_COPY: Record<AgentCardClaimProgress, string> = {
	checking: 'agent_card_claim_step_checking',
	funding: 'agent_card_claim_step_funding',
	waiting_fund: 'agent_card_claim_step_waiting_fund',
	transferring: 'agent_card_claim_step_transferring',
	completing: 'agent_card_claim_step_completing',
	done: 'agent_card_claim_step_done',
}

export type AgentCardClaimPageProps = {
	onEnterHome: () => void
}

export default function AgentCardClaimPage({ onEnterHome }: AgentCardClaimPageProps) {
	const { tu } = useTu()
	const { setIsInitialLoading } = useDaemonContext()
	const unlockDeps = useUnlockMerchantWorkspaceDeps()
	const claimRef = useRef<AgentCardClaimHandoff | null>(peekAgentCardClaimHandoff())
	const claim = claimRef.current

	const [phase, setPhase] = useState<Phase>(claim ? 'create' : 'error')
	const [progress, setProgress] = useState<AgentCardClaimProgress>('checking')
	const [error, setError] = useState(
		claim ? '' : tu('agent_card_claim_missing_handoff'),
	)
	const [createdTag, setCreatedTag] = useState('')
	const [createdTemp, setCreatedTemp] = useState<encrypt_keys_object | null>(null)
	const [enteringHome, setEnteringHome] = useState(false)
	const transferInFlightRef = useRef(false)

	const cardAddress = claim?.cardAddress ?? ''

	const progressLabel = useMemo(() => {
		const key = PROGRESS_COPY[progress]
		return tu(key)
	}, [progress, tu])

	const runTransfer = useCallback(
		async (temp: encrypt_keys_object, beamioTag: string) => {
			const handoff = claimRef.current
			if (!handoff) {
				setError(tu('agent_card_claim_missing_handoff'))
				setPhase('error')
				return
			}
			if (transferInFlightRef.current) return
			transferInFlightRef.current = true
			setPhase('processing')
			setError('')
			setCreatedTag(beamioTag)
			setCreatedTemp(temp)

			const merchantEoa = temp.profiles?.[0]?.keyID?.trim()
			if (!merchantEoa || !ethers.isAddress(merchantEoa)) {
				transferInFlightRef.current = false
				setError(tu('agent_card_claim_no_merchant_eoa'))
				setPhase('error')
				return
			}

			setCoNET_Data(temp)
			setBizWorkspaceRole('merchant')

			const result = await runAgentCardClaim({
				claim: handoff,
				merchantEoa: ethers.getAddress(merchantEoa),
				onProgress: setProgress,
			})

			transferInFlightRef.current = false
			if (!result.ok) {
				setError(result.error || tu('agent_card_claim_transfer_failed'))
				setPhase('error')
				return
			}
			setProgress('done')
			setPhase('success')
		},
		[tu],
	)

	const onCreateSuccess = useCallback(
		(v: BusinessIdentitySuccess) => {
			void runTransfer(v.temp as encrypt_keys_object, v.beamioTag)
		},
		[runTransfer],
	)

	const onDone = useCallback(async () => {
		if (enteringHome) return
		setEnteringHome(true)
		setIsInitialLoading(true)
		try {
			const temp = createdTemp
			if (temp?.profiles?.length) {
				const ok = await unlockMerchantWorkspaceSession(temp, unlockDeps)
				if (!ok) {
					setError(tu('agent_card_claim_unlock_failed'))
					setPhase('error')
					setEnteringHome(false)
					setIsInitialLoading(false)
					return
				}
			}
			clearAgentCardClaimHandoff()
			claimRef.current = null
			setIsInitialLoading(false)
			onEnterHome()
		} catch {
			setError(tu('agent_card_claim_unlock_failed'))
			setPhase('error')
			setEnteringHome(false)
			setIsInitialLoading(false)
		}
	}, [
		createdTemp,
		enteringHome,
		onEnterHome,
		setIsInitialLoading,
		tu,
		unlockDeps,
	])

	const onRetryTransfer = useCallback(() => {
		if (!createdTemp) {
			setPhase('create')
			setError('')
			return
		}
		void runTransfer(createdTemp, createdTag)
	}, [createdTag, createdTemp, runTransfer])

	return (
		<div
			className="flex min-h-[100dvh] w-full flex-col bg-[#F2F2F7] text-slate-900 dark:bg-slate-950 dark:text-slate-50"
			style={{
				paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
				paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
			}}
		>
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-6">
				{phase === 'create' ? (
					<>
						<header className="mb-8 text-center">
							<p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-[#1562F0]">
								{tu('agent_card_claim_eyebrow')}
							</p>
							<h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[#121212] dark:text-slate-100">
								{tu('agent_card_claim_title')}
							</h1>
							<p className="leading-relaxed text-[#666666] dark:text-slate-400">
								{tu('agent_card_claim_sub')}
							</p>
						</header>

						{cardAddress ? (
							<div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
								<p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
									{tu('agent_card_claim_card_label')}
								</p>
								<AddressCapsule
									address={cardAddress}
									className="max-w-full border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
								/>
							</div>
						) : null}

						<div
							role="note"
							className="mb-6 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>{tu('agent_card_claim_existing_blocked')}</p>
						</div>

						<BusinessIdentityForm showIntroHeader={false} onSuccess={onCreateSuccess} />
					</>
				) : null}

				{phase === 'processing' ? (
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1562F0]/10">
							<Loader2 className="h-8 w-8 animate-spin text-[#1562F0]" aria-hidden />
						</div>
						<h1 className="mb-2 text-2xl font-extrabold tracking-tight text-[#121212] dark:text-slate-100">
							{tu('agent_card_claim_processing_title')}
						</h1>
						<p className="mb-1 text-sm text-[#666666] dark:text-slate-400" aria-live="polite">
							{progressLabel}
						</p>
						{createdTag ? (
							<p className="mt-4 text-sm font-semibold text-[#1562F0]">@{createdTag}</p>
						) : null}
						<p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
							{tu('agent_card_claim_processing_hint')}
						</p>
					</div>
				) : null}

				{phase === 'success' ? (
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
							<Check className="h-9 w-9 text-white" strokeWidth={3} aria-hidden />
						</div>
						<h1 className="mb-2 text-2xl font-extrabold tracking-tight text-[#121212] dark:text-slate-100">
							{tu('agent_card_claim_success_title')}
						</h1>
						<p className="mb-2 leading-relaxed text-[#666666] dark:text-slate-400">
							{tu('agent_card_claim_success_sub')}
						</p>
						{createdTag ? (
							<p className="mb-8 text-lg font-bold text-[#1562F0]">@{createdTag}</p>
						) : (
							<div className="mb-8" />
						)}
						{cardAddress ? (
							<div className="mb-8 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
								<p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
									{tu('agent_card_claim_card_label')}
								</p>
								<AddressCapsule
									address={cardAddress}
									className="max-w-full border-slate-200 bg-slate-50 text-slate-700"
								/>
							</div>
						) : null}
						<button
							type="button"
							disabled={enteringHome}
							aria-busy={enteringHome}
							aria-label={tu('agent_card_claim_done')}
							className={`${bizBrandOnboardingPrimaryBtnClass} w-full max-w-sm disabled:opacity-70`}
							onClick={() => void onDone()}
						>
							{enteringHome ? (
								<span className="inline-flex items-center justify-center gap-2">
									<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
									{tu('agent_card_claim_entering')}
								</span>
							) : (
								tu('agent_card_claim_done')
							)}
						</button>
					</div>
				) : null}

				{phase === 'error' ? (
					<div className="flex flex-1 flex-col items-center justify-center text-center">
						<div
							role="alert"
							className="mb-6 flex w-full max-w-sm gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>{error || tu('agent_card_claim_transfer_failed')}</p>
						</div>
						{createdTemp ? (
							<button
								type="button"
								className={`${bizBrandOnboardingPrimaryBtnClass} w-full max-w-sm`}
								onClick={onRetryTransfer}
							>
								{tu('agent_card_claim_retry')}
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}
