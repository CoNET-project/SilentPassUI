import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { IpfsImg } from '@/components/IpfsImg';
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import {
	Zap,
	ChevronRight,
	Fingerprint,
	Gift,
	Check,
	Loader,
	Globe,
	ArrowLeft,
	ArrowRight,
	ShieldCheck,
	AlertTriangle,
	X,
	Nfc,
	Coffee,
	Bike,
	Utensils,
	User,
} from "lucide-react"
import { getAAAccount, getRedeemDetailsForDisplay, postCardRedeem, getMyAssets } from "@/services/BeamioCard"
import { initChat}from '@/services/chat'
import { dispatchBeamioWalletReady } from '@/utils/beamioWalletReadyEvent'
import { ensureConetAaForProfileAndPersist } from '@/utils/ensureConetAa'

import { getUsdcBalanceFromApi, formatWithThousands, isStandalone } from "@/services/beamio"
import { ethers } from "ethers"
import { CCSA_Card_Address } from "@/utils/constants"
import { BASE_MAINNET_FACTORIES } from "@/config/chainAddresses"
import { updateManifestStartUrl } from "@/utils/updateManifestStartUrl"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { getUserInfo, storeSystemData, checkStorageWithTimeout, restoreWithRedeem, ensureProfilePrivateKeyArmorFromMnemonic } from "@/services/beamio"
import {
	beamioTagFromUrlSearch,
	consumerAppNeedsWalletRecover,
	hasCompletedBeamioAccount,
	hasLocalPlaintextMnemonic,
	knownBeamioAccountNameFromStorage,
} from '@/utils/consumerWalletGate'
import { ensureEphemeralWalletForCouponClaim } from '@/utils/ephemeralCouponClaimWallet'
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import CreateUsernamePinScreen, { type CreateUsernamePinScreenRef } from './CreateUsernamePinScreen'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreWalletUnifiedScreen from './RestoreWalletUnifiedScreen'
import WalletReadyScreen from './WalletReadyScreen'
import RedeemVoucherScreen from './RedeemVoucherScreen'
import ActiveCouponsScreen from './ActiveCouponsScreen'
import { WALLET_READY_INTENT_KEY } from './walletReadyIntent'
import { buildRedeemVoucherHistoryPath } from './redeemVoucherPath'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import OnboardingWelcomeScreen from './OnboardingWelcomeScreen'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'
import { VERRA_BRAND_LOGO_SRC } from '@/ui/verraBrandAssets'
import { tu } from '@/locale/beamioLocale'
import { applyBeamioUiLanguageFromProfile, type BeamioUiLocale } from '@/locale/i18n'
import { useTranslation } from 'react-i18next'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'


const APP_VERSION = (packageJson as { version?: string }).version ?? ''
/** Initial entry hero — user-provided city sunset (onboard.html） */
const ONBOARD_HERO_BG = `${process.env.PUBLIC_URL ?? ''}/onboard-hero-city.png`
const ONBOARD_APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`
const ONBOARD_HERO_MARQUEE_SEC_PER_LOOP = 160
const ISSUED_NFT_START_ID = 100_000_000_000

/** 从 NFT tokenId 推导卡号显示：issued NFT 用序号，tier NFT 用 tokenId */
function formatMemberNo(tokenId: string | number): string {
	const n = Number(tokenId)
	if (n >= ISSUED_NFT_START_ID) {
		return `M-${String(n - ISSUED_NFT_START_ID + 1).padStart(6, '0')}`
	}
	return `M-${String(n).padStart(6, '0')}`
}

function OnboardHeroMarquee() {
	const viewportRef = useRef<HTMLDivElement | null>(null)
	const trackRef = useRef<HTMLDivElement | null>(null)
	const panel0Ref = useRef<HTMLDivElement | null>(null)

	useLayoutEffect(() => {
		if (typeof window === 'undefined') return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		const vp = viewportRef.current
		const track = trackRef.current
		const p0 = panel0Ref.current
		if (!vp || !track || !p0) return

		let segmentPx = 0
		let offsetPx = 0
		let raf = 0
		let last = performance.now()

		const applyLayout = () => {
			const w = Math.max(1, Math.round(vp.clientWidth))
			const prevSeg = segmentPx
			const prevOff = offsetPx

			track.style.width = `${2 * w}px`
			p0.style.flexShrink = '0'
			p0.style.width = `${w}px`
			const p1 = track.children[1]
			if (p1 instanceof HTMLElement) {
				p1.style.flexShrink = '0'
				p1.style.width = `${w}px`
			}
			void track.offsetHeight

			segmentPx = Math.max(1, p0.offsetWidth)

			if (prevSeg > 0 && segmentPx !== prevSeg) {
				let u = -prevOff / prevSeg
				u -= Math.floor(u)
				offsetPx = -u * segmentPx
			}
			while (offsetPx <= -segmentPx) offsetPx += segmentPx
			while (offsetPx > 0) offsetPx -= segmentPx
			track.style.transform = `translate3d(${offsetPx}px,0,0.01px)`
		}

		applyLayout()

		const ro = new ResizeObserver(applyLayout)
		ro.observe(vp)

		const tick = (now: number) => {
			const dt = Math.min(Math.max(now - last, 0), 100)
			last = now
			const seg = segmentPx
			if (seg <= 0) {
				raf = requestAnimationFrame(tick)
				return
			}
			offsetPx -= (seg / (ONBOARD_HERO_MARQUEE_SEC_PER_LOOP * 1000)) * dt
			while (offsetPx <= -seg) {
				offsetPx += seg
			}
			track.style.transform = `translate3d(${offsetPx}px,0,0.01px)`
			raf = requestAnimationFrame(tick)
		}

		raf = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(raf)
			ro.disconnect()
		}
	}, [])

	return (
		<div
			ref={viewportRef}
			className="pointer-events-none absolute inset-0 z-0 min-h-full overflow-hidden"
		>
			<div className="absolute inset-0 hidden motion-reduce:block" aria-hidden>
				<IpfsImg
					src={ONBOARD_HERO_BG}
					alt=""
					className="h-full w-full object-cover blur-sm"
					draggable={false}
				/>
			</div>
			<div
				ref={trackRef}
				className="absolute left-0 top-0 z-0 flex h-full flex-nowrap motion-reduce:hidden will-change-transform [transform:translate3d(0,0,0.01px)]"
				aria-hidden
			>
				<div ref={panel0Ref} className="relative h-full shrink-0 overflow-hidden">
					<IpfsImg
						src={ONBOARD_HERO_BG}
						alt=""
						className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
						draggable={false}
					/>
				</div>
				<div className="relative h-full shrink-0 overflow-hidden">
					<IpfsImg
						src={ONBOARD_HERO_BG}
						alt=""
						className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
						draggable={false}
					/>
				</div>
			</div>
			<div className="absolute inset-0 z-10 bg-[#1562f0]/40 mix-blend-multiply" aria-hidden />
			<div
				className="absolute inset-0 z-20 bg-gradient-to-b from-[#1562f0]/60 via-transparent to-[#1562f0]/80"
				aria-hidden
			/>
		</div>
	)
}

/** 首屏铺满：避免仅依赖 100dvh（部分机型 dvh 小于实际可视高度 → 底部露白）。高度由外层 fixed inset-0 + flex-1 传递。 */
const INITIAL_SPLASH_VIEWPORT = 'min-h-0 w-full flex-1'
const INITIAL_HEADLINE_TO_BODY_SPACE_Y =
	'space-y-5 sm:space-y-6 md:space-y-7 [@media(max-height:720px)]:space-y-4'
const INITIAL_COPY_TO_CTA_MARGIN_TOP = 'mt-5 sm:mt-6 md:mt-7 [@media(max-height:720px)]:mt-4'
const INITIAL_HERO_TO_COPY_MARGIN = 'mb-3 md:mb-5 [@media(max-height:720px)]:mb-2'
const INITIAL_COPY_TO_BANNER_MARGIN = 'mt-3 md:mt-5 [@media(max-height:720px)]:mt-2'

type InitialEntrySplashProps = {
	appVersion: string
	isStandalone: boolean
	onGetStarted: () => void
	onRestoreWallet: () => void
}

function OnboardLocalePicker() {
	const { i18n } = useTranslation()
	const locale = (i18n.language === 'en' ? 'en' : 'zh-CN') as BeamioUiLocale

	return (
		<BeamioLocalePicker
			variant="hero"
			menuAlign="left"
			locale={locale}
			onSelect={async (next) => {
				await applyBeamioUiLanguageFromProfile(next)
			}}
		/>
	)
}

/** Must stay module-scoped: an inline component inside LoadingPage gets a new `type` every parent render → full remount and marquee reset. */
function InitialEntrySplash({
	appVersion,
	isStandalone,
	onGetStarted,
	onRestoreWallet,
}: InitialEntrySplashProps) {
	return (
		<div
			className={[
				'relative flex w-full flex-col overflow-hidden overscroll-none font-sans',
				INITIAL_SPLASH_VIEWPORT,
				'bg-[#1562f0]',
			].join(' ')}
		>
			<OnboardHeroMarquee />

			<nav
				className="fixed top-0 z-50 flex w-full items-center px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:px-8"
				aria-label="Beamio"
			>
				<div className="flex min-w-0 flex-1 items-center justify-start">
					<OnboardLocalePicker />
				</div>
				<div className="flex shrink-0 items-center gap-2.5 text-white">
					<IpfsImg
						src={ONBOARD_APP_LOGO_SRC}
						alt="Beamio"
						className="h-9 w-9 shrink-0 rounded-[10px] object-contain"
						draggable={false}
					/>
					<span className="text-lg font-semibold tracking-[0.02em]">Beamio</span>
				</div>
				<div className="flex min-w-0 flex-1 items-center justify-end">
					{appVersion ? (
						<span className="text-[11px] font-medium tabular-nums text-white/50">v{appVersion}</span>
					) : null}
				</div>
			</nav>

			<main className="relative z-30 mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center overflow-hidden px-4 pb-2 pt-[calc(env(safe-area-inset-top)+4.25rem)] text-center sm:px-6 [@media(max-height:720px)]:pb-1 [@media(max-height:720px)]:pt-[calc(env(safe-area-inset-top)+3.75rem)]">
				<div className="flex w-full min-h-0 max-w-4xl flex-1 flex-col items-center justify-center gap-0 py-1 [@media(max-height:720px)]:py-0">
					<div
						className={[
							'relative z-0 shrink-0 pb-8 [@media(max-height:720px)]:pb-6 sm:pb-10 md:mb-0 [@media(max-height:720px)]:scale-[0.94] [@media(max-height:720px)]:origin-center',
							INITIAL_HERO_TO_COPY_MARGIN,
						].join(' ')}
					>
						<div className="relative flex h-[11rem] w-[11rem] items-center justify-center rounded-full border-[3px] border-[#1562f0]/40 shadow-[0_0_60px_rgba(21,98,240,0.3)] sm:h-[14rem] sm:w-[14rem] [@media(max-height:720px)]:h-[9.25rem] [@media(max-height:720px)]:w-[9.25rem]">
							<div
								className="pointer-events-none absolute inset-0 animate-ping rounded-full border-[1.5px] border-white/20 opacity-20"
								style={{ animationDuration: '3s' }}
								aria-hidden
							/>
							<div
								className="relative flex h-[9.25rem] w-[9.25rem] items-center justify-center overflow-hidden rounded-full sm:h-[11.25rem] sm:w-[11.25rem] [@media(max-height:720px)]:h-[7.75rem] [@media(max-height:720px)]:w-[7.75rem]"
								style={{
									background:
										'radial-gradient(circle, rgba(255, 181, 154, 0.8) 0%, rgba(179, 255, 171, 0.2) 70%)',
								}}
							>
								<div
									className="absolute inset-0 bg-gradient-to-br from-[#ffb59a] to-[#b3ffab] opacity-40"
									aria-hidden
								/>
								<span className="relative z-10 flex h-full w-full items-center justify-center">
									<Nfc
										className="block h-12 w-12 shrink-0 text-white drop-shadow-lg sm:h-14 sm:w-14 [@media(max-height:720px)]:h-10 [@media(max-height:720px)]:w-10"
										strokeWidth={1.5}
										aria-hidden
									/>
								</span>
							</div>
							<div className="absolute -right-1 -top-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md sm:-right-2 sm:-top-4 sm:h-12 sm:w-12">
								<Coffee className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
							</div>
							<div className="absolute top-1/2 -left-8 flex h-10 w-10 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-md sm:-left-10 sm:h-12 sm:w-12">
								<Bike className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
							</div>
							<div className="absolute -bottom-1 right-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md sm:-bottom-2 sm:right-4 sm:h-12 sm:w-12">
								<Utensils className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
							</div>
							<div className="absolute -bottom-6 left-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md sm:-bottom-8 sm:left-6 sm:h-12 sm:w-12">
								<User className="h-4 w-4 shrink-0 text-white sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
							</div>
						</div>
					</div>

					<div className={['relative z-20 max-w-2xl shrink-0', INITIAL_HEADLINE_TO_BODY_SPACE_Y].join(' ')}>
						<h1 className="font-extrabold leading-tight tracking-tight text-[#fef9c3] text-[1.5rem] sm:text-3xl md:text-4xl [@media(max-height:720px)]:text-[1.35rem] [@media(max-height:720px)]:leading-snug">
							<span className="block">{tu('your_communitys_heartbeat')}</span>
							<span className="block">{tu('found_in_your_phone')}</span>
						</h1>
						<div className="mx-auto max-w-xl space-y-0 text-sm font-light leading-tight tracking-wide text-white/90 sm:text-base md:text-lg [&_p+p]:-mt-1 sm:[&_p+p]:-mt-1.5 [@media(max-height:720px)]:text-[13px] [@media(max-height:720px)]:leading-snug">
							<p>{tu('discover_and_connect_with_independent')}</p>
							<p>{tu('businesses_you_love')}</p>
							<p>{tu('every_tap_tells_a_local_story')}</p>
						</div>
					</div>

					{isStandalone ? (
						<div
							className={[
								'mb-2 w-full max-w-md shrink-0 rounded-2xl border border-amber-200/40 bg-amber-950/35 p-3 text-left backdrop-blur-md [@media(max-height:720px)]:p-2.5',
								INITIAL_COPY_TO_BANNER_MARGIN,
							].join(' ')}
						>
							<p className="text-[14px] font-medium leading-snug text-amber-50 [@media(max-height:720px)]:text-[13px]">
								{tu('opened_from_home_screen_wallet_data_from_safari_doesnt_transfer_use')}{' '}
								<strong className="text-white">{tu('restore_wallet')}</strong>{' '}
								{tu('with_your_recovery_code_below')}
							</p>
						</div>
					) : null}

					<div
						className={[
							'flex w-full max-w-md shrink-0 flex-col items-center gap-3 [@media(max-height:720px)]:gap-2',
							INITIAL_COPY_TO_CTA_MARGIN_TOP,
						].join(' ')}
					>
						<AppButton
							fullWidth
							className="
              group relative overflow-hidden rounded-full !h-auto min-h-[52px] px-8 py-4 text-base font-bold tracking-wide
              sm:min-h-[56px] sm:px-10 sm:py-5 sm:text-lg
              [@media(max-height:720px)]:min-h-[48px] [@media(max-height:720px)]:py-3.5 [@media(max-height:720px)]:text-[15px]
              !bg-[#1562f0] hover:!opacity-[0.94] active:!scale-[0.98]
              !text-white
              !shadow-xl
              focus-visible:!ring-2 focus-visible:!ring-white/60 focus-visible:!ring-offset-2 focus-visible:!ring-offset-[#0e4cbb]/40
            "
							onClick={onGetStarted}
						>
							<span className="relative z-10 inline-flex items-center justify-center gap-2 uppercase">
								{tu('get_started')}
								<ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
							</span>
						</AppButton>
						<button
							type="button"
							onClick={onRestoreWallet}
							className="text-sm font-medium tracking-wide text-white/75 transition-colors hover:text-white focus:outline-none focus-visible:underline"
						>
							{tu('already_have_a_beamio_id')}{' '}
							<span className="underline underline-offset-4">{tu('restore_wallet')}</span>
						</button>
					</div>
				</div>
			</main>

			<footer className="relative z-30 w-full shrink-0 px-6 pt-1 text-center pb-[calc(2rem+env(safe-area-inset-bottom))] [@media(max-height:720px)]:pt-0.5">
				<p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">{tu('powered_by_beamio')}</p>
			</footer>
		</div>
	)
}

// Simple mobile-style onboarding modal for CashTrees (SilentPass UI shell)
// TailwindCSS-based layout

type Props = {
	home: () => void
	onInitComplete?: () => void
	/** Account exists locally but plaintext mnemonic missing — force Restore (BeamioTag + password). */
	requireWalletRecover?: boolean
	/** AppEntryGate 已读到本地存储（含超时降级），下传后弹窗不再二次 checkStorage（Safari 私密模式会挂起）。 */
	bootResolved?: boolean
	bootCoNETData?: encrypt_keys_object | null
}

const TOP_OFFSET = "calc(env(safe-area-inset-top) + 4rem)"

/** 处于 onboarding 子屏时不触发自动 home()（含优惠券列表 / 手动兑换） */
const ONBOARDING_MODAL_SCREENS = new Set([
	'CreateUsernamePinScreen',
	'RecoveryQRScreen',
	'OnboardingWelcomeScreen',
	'WalletReadyScreen',
	'RestoreWalletScreen',
	'ActiveCouponsScreen',
	'RedeemVoucherScreen',
])

type RedeemSplashStepProps = {
	onActivate: () => void
	redeemDetails: import('@/services/BeamioCard').RedeemDetailsForDisplay | null
	redeemDetailsLoading: boolean
}

/** Redeem 首次进入 Step1：图示样式，Activate Now 进入 Create Wallet；redeem 无效时显示警告 */
function RedeemSplashStep({ onActivate, redeemDetails, redeemDetailsLoading }: RedeemSplashStepProps) {
	const safeArea = { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }
	const isValid = !redeemDetailsLoading && redeemDetails !== null && redeemDetails.status === 'pending'
	const isInvalid = !redeemDetailsLoading && (redeemDetails === null || redeemDetails.status !== 'pending')
	return (
		<div className="min-h-screen bg-[#F5F5F7] flex flex-col relative overflow-hidden font-sans" style={safeArea}>
			{APP_VERSION && <div className="absolute top-[env(safe-area-inset-top)] right-6 z-50 text-[11px] text-slate-500/30">v{APP_VERSION}</div>}
			<div className="w-full h-14 bg-transparent z-50" />
			<div className="flex-1 flex flex-col items-center px-6 pt-4 relative z-10">
				{isInvalid ? (
					<div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-4 py-3 rounded-2xl mb-8 w-full max-w-sm">
						<AlertTriangle size={20} className="text-orange-600 shrink-0" />
						<div>
							<span className="text-[13px] font-bold text-orange-800 block">{tu('invalid_redeem_code')}</span>
							<span className="text-[12px] text-orange-700 leading-snug">
								{redeemDetails?.status === 'not_found' ? 'This code has already been used or does not exist.' : redeemDetails?.status === 'cancelled' ? 'This redeem has been cancelled.' : 'Unable to verify this redeem code. Please check the link and try again.'}
							</span>
						</div>
					</div>
				) : (
				<div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/40 px-4 py-2 rounded-full shadow-sm mb-8">
					<div className="w-4 h-4 rounded-full bg-[#1562f0] flex items-center justify-center"><ShieldCheck size={10} className="text-white" /></div>
					<span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">{tu('verified_asset_ready_to_claim')}</span>
				</div>
				)}
				<div className="w-full max-w-[340px] perspective-1000 mb-10">
					<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
						<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
						<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
						<div className="relative z-10 p-5 h-full flex flex-col justify-between">
							<div className="flex justify-between items-start">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' }}><Globe className="h-5 w-5 text-white" /></div>
									<div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 font-serif">CARD</div></div>
								</div>
								<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1 text-white"><Globe size={10} className="text-white" /> Membership</div>
							</div>
							<div><p className="text-[10px] font-bold opacity-80 uppercase mb-0.5">{tu('balance')}</p><div className="flex items-baseline gap-1"><span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">{isValid && redeemDetails ? (() => { const pts = Number(redeemDetails.pointsHuman); const ptsPer1 = Number(redeemDetails.ptsPer1Currency); const amt = ptsPer1 ? pts / ptsPer1 : pts; return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined); })() : '100.00'}</span><span className="text-sm font-semibold opacity-90 text-[#fff2c6]">{isValid && redeemDetails ? (redeemDetails.currency as string) : 'CAD'}</span></div></div>
						</div>
					</div>
					<div className="w-[90%] h-4 mx-auto bg-[#1562f0]/20 blur-xl rounded-full mt-4" />
				</div>
				<div className="mt-4 text-center space-y-3 max-w-xs mx-auto">
					<h1 className="text-3xl font-bold text-slate-900 tracking-tight">{tu('activate_your_card')}</h1>
					<p className="text-slate-500 text-[15px] font-medium leading-relaxed">{tu('create_a_secure_cashtrees_wallet_to_claim_this_membership_no_app_downloa')}</p>
				</div>
			</div>
			<div className="p-6 pb-10 mb-40 bg-gradient-to-t from-[#F5F5F7] to-transparent z-20">
				<button
					type="button"
					onClick={onActivate}
					disabled={isInvalid}
					className={`group w-full h-16 rounded-full font-bold text-[17px] transition-all flex items-center justify-between px-2 pl-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/70 focus-visible:ring-offset-2 ${isValid ? 'bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] text-white shadow-lg shadow-[#1562f0]/35 active:scale-95' : isInvalid ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] text-white shadow-lg shadow-[#1562f0]/35 animate-pulse'}`}
				>
					<span>{tu('activate_now')}</span>
					<div className={`w-12 h-12 rounded-full flex items-center justify-center ${isValid ? 'bg-white text-[#1562f0] group-hover:scale-105' : isInvalid ? 'bg-slate-100' : 'bg-white/90 text-[#1562f0]'}`}><ArrowRight size={24} strokeWidth={3} /></div>
				</button>
			</div>
		</div>
	)
}

/** 从 URL 解析 beamiocard + redeemcode */
function parseRedeemFromUrl(): { cardAddress: string; redeemCode: string } | null {
	if (typeof window === 'undefined') return null
	const sp = new URLSearchParams(window.location.search)
	const redeemCode = sp.get('redeemcode') || sp.get('Redeemcode') || ''
	if (!redeemCode?.trim()) return null
	const cardAddress = (sp.get('beamiocard') || sp.get('Beamiocard') || '').trim()
	return {
		cardAddress: cardAddress && ethers.isAddress(cardAddress) ? cardAddress : CCSA_Card_Address,
		redeemCode: decodeURIComponent(redeemCode.trim()),
	}
}

export default function BeamioOnboardingModal({ home, onInitComplete, requireWalletRecover = false, bootResolved = false, bootCoNETData = null }: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, 
		setAllNodes, setGossip, gossip,
		setIsInitialLoading, myAddress, setMyAddress, usdcbalance, setShowFooter, setCharts } = useDaemonContext()
	const [walletAddr, setWalletAddr] = useState('')
	const [usdcBal, setUsdcBal] = useState('0')
	const [eoaAddress, setEoaAddress] = useState('')
	const [loading, SetLoading] = useState(true)
	const navigate = useNavigate()

	const [settingsOpen, setSettingsOpen] = useState<''|'CreateUsernamePinScreen'|'RecoveryQRScreen'|'OnboardingWelcomeScreen'|'WalletReadyScreen'|'RestoreWalletScreen'|'ActiveCouponsScreen'|'RedeemVoucherScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(false)
	const [qrDataUrl, setQrDataUrl] = useState('')
	const [recoveryCode, setRecoveryCode]  = useState('')
	const [beamioTag, setBeamioTag] = useState('')
	const [temp, setTemp] = useState<any>()

	// Redeem from URL (beamiocard + redeemcode)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress: string; redeemCode: string } | null>(null)
	const [hasCheckedUrl, setHasCheckedUrl] = useState(false)
	/** 从 URL 的 MasterKey 参数进入的 recover 模式，restore 失败时预填恢复码 */
	const [restoreFromUrlMasterKey, setRestoreFromUrlMasterKey] = useState('')
	const [redeemDetails, setRedeemDetails] = useState<import('@/services/BeamioCard').RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [redeeming, setRedeeming] = useState(false)
	const [redeemDone, setRedeemDone] = useState(false)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [ccsaAssets, setCcsaAssets] = useState<{ points: string; nfts: { tokenId: string }[] } | null>(null)
	const redeemHandledByRecoveryRef = useRef(false)
	const createUsernameRef = useRef<CreateUsernamePinScreenRef>(null)
	const homeCalledRef = useRef(false)
	const enterHomeInFlightRef = useRef(false)
	const [redeemActivating, setRedeemActivating] = useState(false)
	const [redeemPostCreateInProgress, setRedeemPostCreateInProgress] = useState(false)
	/** Create Wallet 加密中：全屏居中 loading，隐藏 BeamioNavBack，避免顶光晕被裁切 */
	const [createWalletLoading, setCreateWalletLoading] = useState(false)

	useEffect(() => {
		if (settingsOpen !== "CreateUsernamePinScreen") setCreateWalletLoading(false)
	}, [settingsOpen])

	// 隐藏全局 footer：redeem 进行中 Loading 或 Card Active 成功页
	useEffect(() => {
		const shouldHide = redeemActivating || redeeming || (redeemFromUrl && !redeeming && redeemResult?.success)
		setShowFooter?.(!shouldHide)
		return () => setShowFooter?.(true)
	}, [redeemActivating, redeeming, redeemFromUrl, redeemResult?.success, setShowFooter])

	const init = async (temp?: encrypt_keys_object, opts?: { dontClose?: boolean }) => {
		// 显式传入的 restore/create 结果优先；仅缺失时才读本地（带超时，避免 Safari 私密模式挂起）。
		let working = temp?.profiles?.length ? temp : null
		if (!working) {
			working = await checkStorageWithTimeout()
		}
		if (!working?.profiles?.length) {
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			onInitComplete?.()
			return
		}

		working = ensureProfilePrivateKeyArmorFromMnemonic(working) ?? working

		const profiles = working.profiles

		if (!working || !profiles) {
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			onInitComplete?.()
			return
		}

		if (!hasLocalPlaintextMnemonic(working)) {
			setIsInitialLoading(true)
			setIsInitialEntry(false)
			setSettingsOpen('RestoreWalletScreen')
			setHasCheckedUrl(true)
			onInitComplete?.()
			return
		}

		setProfiles(profiles)

		let userInfo: beamio | null = null
		for (let attempt = 0; attempt < 20; attempt++) {
			userInfo = await getUserInfo(profiles[0].keyID)
			if (userInfo) break
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}
		if (!userInfo) {
			userInfo = working.beamio ?? null
		}
		if (!userInfo) return

		const bo: beamio = userInfo

		SetLoading(true)
		await initChat(setProfiles, setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})
		dispatchBeamioWalletReady('loading-page-init')

		bo.initialLoading = true

		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		working.beamio = bo

		setCoNET_Data(working)
		await storeSystemData()
		const eoa = profiles[0]?.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) {
			setEoaAddress(eoa)
			setMyAddress(eoa)
		}
		SetLoading(false)
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		if (!opts?.dontClose) setSettingsOpen('')
		onInitComplete?.()
  	}

	let first = true

	// 仅适用于首次启动（本地存储无 beamio 信息）时的启动 URL 参数，不适用于 scan QR workflow
	useEffect(() => {
		if (!first) return
		first = false
		const run = async () => {
			const ephemeralReady = await ensureEphemeralWalletForCouponClaim()
			if (ephemeralReady) {
				await init(ephemeralReady)
				home()
				return
			}

			if (requireWalletRecover) {
				// 优先用门闸已读到的快照，避免 Safari 私密模式 checkStorage 二次挂起。
				const isAcc = bootResolved ? bootCoNETData : await checkStorageWithTimeout()
				if (isAcc && consumerAppNeedsWalletRecover(isAcc)) {
					setIsInitialEntry(false)
					setSettingsOpen('RestoreWalletScreen')
					setHasCheckedUrl(true)
					onInitComplete?.()
					return
				}
			}
			const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
			const beamioTagParam = urlParams?.get('beamioTag')
			const masterKeyParam = urlParams?.get('MasterKey')
			// beamioTag 优先于 beamiocard：若有 beamioTag，忽略 beamiocard/redeemcode，进入恢复 wallet 流程
			if (beamioTagParam) {
				if (masterKeyParam) {
					try {
						const restored = await restoreWithRedeem(masterKeyParam, '')
						if (restored) {
							await init(restored)
							// 保持 beamioTag、MasterKey 参数在 URL 中，不删除
							return
						}
					} catch (_) {}
					setIsInitialEntry(true)
					setRestoreFromUrlMasterKey(masterKeyParam)
					setSettingsOpen('RestoreWalletScreen')
					setHasCheckedUrl(true)
					onInitComplete?.()
					return
				}
				// beamioTag 存在但无 MasterKey：直接进入统一恢复页
				setIsInitialEntry(true)
				setSettingsOpen('RestoreWalletScreen')
				setHasCheckedUrl(true)
				onInitComplete?.()
				return
			}
			// 门闸已确认本地无账号（含 IndexedDB 挂起超时降级）：直接进入初始 onboarding 主页（hero），
			// 不再调用 init() 内的 checkStorage()，避免 Safari 私密模式再次挂起卡成黑屏。
			if (bootResolved && !hasCompletedBeamioAccount(bootCoNETData)) {
				setIsInitialLoading(true)
				setIsInitialEntry(true)
				onInitComplete?.()
				return
			}
			init()
		}
		run()
	}, [])

	// 解析启动 URL 中的 redeem 参数（仅 window.location，非 scan QR）；beamioTag 优先时忽略 beamiocard/redeemcode
	useEffect(() => {
		const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
		const hasBeamioTag = !!(urlParams?.get('beamioTag')?.trim())
		if (hasBeamioTag) {
			setRedeemFromUrl(null)
			setHasCheckedUrl(true)
			return
		}
		const parsed = parseRedeemFromUrl()
		setRedeemFromUrl(parsed)
		setHasCheckedUrl(true)
	}, [])

	/** 往 PWA 传递参数的通用逻辑：更新 URL（beamioTag + MasterKey，移除 redeem 参数）+ 刷新 manifest start_url */
	const applyPwaUrlParams = (tag: string, key: string) => {
		if (!tag || !key || typeof window === 'undefined') return
		try {
			const url = new URL(window.location.href)
			url.searchParams.set('beamioTag', tag)
			url.searchParams.set('MasterKey', key)
			;['beamiocard', 'Beamiocard', 'redeemcode', 'Redeemcode'].forEach(k => url.searchParams.delete(k))
			const newHref = url.toString()
			window.history.replaceState({}, '', newHref)
			updateManifestStartUrl(newHref)
		} catch (_) {}
	}

	// Card Active! 或 Wallet Ready! 进入时：更新 URL 并刷新 manifest（PWA 添加到主屏幕时携带 beamioTag、MasterKey）
	useEffect(() => {
		if (typeof window === 'undefined') return
		const isCardActive = redeemFromUrl && !redeeming && redeemResult?.success
		const isWalletReady =
			settingsOpen === 'WalletReadyScreen' || settingsOpen === 'OnboardingWelcomeScreen'
		if ((isCardActive || isWalletReady) && beamioTag && recoveryCode) {
			const t = setTimeout(() => applyPwaUrlParams(beamioTag, recoveryCode), isCardActive ? 300 : 400)
			return () => clearTimeout(t)
		}
		if (isWalletReady) updateManifestStartUrl(window.location.href)
	}, [settingsOpen, redeemFromUrl, redeeming, redeemResult?.success, beamioTag, recoveryCode])

	// loading ready 后：无 redeem URL 则直接进入 home（防重复调用）；onboarding 子屏阶段不触发
	useEffect(() => {
		if (isInitialEntry || !hasCheckedUrl || redeemFromUrl !== null || loading) return
		if (settingsOpen && ONBOARDING_MODAL_SCREENS.has(settingsOpen)) return
		if (consumerAppNeedsWalletRecover(CoNET_Data)) return
		if (homeCalledRef.current) return
		homeCalledRef.current = true
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		home()
	}, [isInitialEntry, hasCheckedUrl, redeemFromUrl, loading, settingsOpen, home])

	/** 已有 AA 时跳过 STEP 05（WalletReadyScreen），直接进入首页 */
	const finishOnboardingToHome = () => {
		setSettingsOpen('')
		home()
		navigate('/')
	}

	const handleOnboardingEnterHome = async () => {
		if (enterHomeInFlightRef.current) return
		enterHomeInFlightRef.current = true
		try {
			const profile = CoNET_Data?.profiles?.[0] ?? temp?.profiles?.[0]
			if (profile?.keyID && ethers.isAddress(profile.keyID)) {
				try {
					const aa = await ensureConetAaForProfileAndPersist(profile, setProfiles)
					if (aa) setWalletAddr(aa)
				} catch {
					/* 不可信失败：仍进 Home，AppShell 会重试 ensure */
				}
			}
			finishOnboardingToHome()
		} finally {
			enterHomeInFlightRef.current = false
		}
	}

	// Wallet Ready：获取 AA 地址与 USDC 余额，并记录 EOA 地址
	useEffect(() => {
		if (isInitialEntry) return
		const profile = CoNET_Data?.profiles?.[0]
		if (!profile) return
		const eoa = profile.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) setEoaAddress(eoa)
		let cancelled = false
		getAAAccount(profile).then((aa) => {
			if (cancelled || !aa) return
			setWalletAddr(aa)
			getUsdcBalanceFromApi(aa).then((b) => {
				if (!cancelled && b != null) setUsdcBal(b)
			}).catch(() => {})
		}).catch(() => {})
		return () => { cancelled = true }
	}, [isInitialEntry, CoNET_Data?.profiles])

	// 有 redeem URL 时拉取 redeem 详情（用于显示金额 + Splash 页校验）
	useEffect(() => {
		if (!redeemFromUrl) return
		let cancelled = false
		setRedeemDetailsLoading(true)
		const cardAddr = redeemFromUrl.cardAddress
		const code = redeemFromUrl.redeemCode
		;(async () => {
			const d = await getRedeemDetailsForDisplay(cardAddr, code)
			if (!cancelled) {
				setRedeemDetails(d ?? null)
			}
		})().finally(() => {
			if (!cancelled) setRedeemDetailsLoading(false)
		})
		return () => { cancelled = true }
	}, [redeemFromUrl])

	// redeem 流程：CreateUsernamePinScreen 关闭后，连续执行 store profile + redeem，再进入 Master Key 页（无二次 Activating）
	useEffect(() => {
		if (settingsOpen !== 'RecoveryQRScreen' || !redeemFromUrl || !temp || !redeemPostCreateInProgress) return
		let cancelled = false
		redeemHandledByRecoveryRef.current = true
		;(async () => {
			try {
				await init(temp, { dontClose: true })
				if (cancelled) return
				const profile = temp?.profiles?.[0]
				let toUserEOA = ''
				if (profile?.keyID && ethers.isAddress(profile.keyID)) toUserEOA = profile.keyID
				else if (profile?.privateKeyArmor) {
					try { toUserEOA = new ethers.Wallet(profile.privateKeyArmor).address } catch {}
				}
				if (toUserEOA && ethers.isAddress(toUserEOA) && redeemFromUrl) {
					setRedeeming(true)
					const result = await postCardRedeem(redeemFromUrl.cardAddress, redeemFromUrl.redeemCode, toUserEOA)
					if (!cancelled) {
						setRedeemDone(true)
						setRedeemResult(result.success ? { success: true, tx: result.tx } : { success: false, error: result.error ?? tu('redeem_failed_2') })
						if (result.success && profile) {
							// 1. 使用正确的卡地址：redeem 目标卡（redeemFromUrl.cardAddress），自定义 beamiocard 时否则会查到错误卡
							const cardAddr = redeemFromUrl.cardAddress || CCSA_Card_Address
							const assets = await getMyAssets(profile, cardAddr).catch(() => null)
							if (!cancelled && assets) setCcsaAssets({ points: assets.points, nfts: assets.nfts ?? [] })
						}
					}
					setRedeeming(false)
				}
			} finally {
				if (!cancelled) {
					setRedeemPostCreateInProgress(false)
					setRedeemActivating(false)
				}
			}
		})()
		return () => { cancelled = true }
	}, [settingsOpen, redeemFromUrl, temp, redeemPostCreateInProgress])

	// 有 redeem URL 时在后台执行 redeem，完成后拉取 CCSA 资产（仅 restore 流程，CreateUsernamePinScreen 流程由上方 effect 处理）
	useEffect(() => {
		if (!redeemFromUrl || isInitialEntry || redeemHandledByRecoveryRef.current) return
		const profile = CoNET_Data?.profiles?.[0]
		let toUserEOA = ''
		if (profile?.keyID && ethers.isAddress(profile.keyID)) {
			toUserEOA = profile.keyID
		} else if (profile?.privateKeyArmor) {
			try {
				toUserEOA = new ethers.Wallet(profile.privateKeyArmor).address
			} catch {}
		}
		if (!toUserEOA || !ethers.isAddress(toUserEOA)) return
		let cancelled = false
		setRedeeming(true)
		postCardRedeem(redeemFromUrl.cardAddress, redeemFromUrl.redeemCode, toUserEOA)
			.then((result) => {
				if (cancelled) return
				setRedeemDone(true)
				setRedeemResult(result.success ? { success: true, tx: result.tx } : { success: false, error: result.error ?? tu('redeem_failed_2') })
				if (result.success && profile) {
					// 1. 使用正确的卡地址：redeem 目标卡（redeemFromUrl.cardAddress），自定义 beamiocard 时否则会查到错误卡
					const cardAddr = redeemFromUrl.cardAddress || CCSA_Card_Address
					getMyAssets(profile, cardAddr).then((assets) => {
						if (!cancelled && assets) {
							setCcsaAssets({ points: assets.points, nfts: assets.nfts ?? [] })
						}
					}).catch(() => {})
				}
			})
			.finally(() => {
				if (!cancelled) setRedeeming(false)
			})
		return () => { cancelled = true }
	}, [redeemFromUrl, isInitialEntry])

	const initialSplashOnly = isInitialEntry && !redeemFromUrl && !settingsOpen
	const showInitialEntrySplash = isInitialEntry && !settingsOpen
	const onboardingSubScreenOpen = isInitialEntry && !!settingsOpen

	return (
		<div
			className={[
				'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
				initialSplashOnly
					? 'fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[#1562f0] pt-0 pb-0'
					: onboardingSubScreenOpen
						? 'fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-900 pt-0 pb-0'
					: 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
			].join(' ')}
		>
			<div className={initialSplashOnly || onboardingSubScreenOpen ? 'flex min-h-0 flex-1 flex-col' : ''}>
				{
					showInitialEntrySplash ? (redeemFromUrl ? <RedeemSplashStep onActivate={() => setSettingsOpen("CreateUsernamePinScreen")} redeemDetails={redeemDetails} redeemDetailsLoading={redeemDetailsLoading} /> : (
						<InitialEntrySplash
							appVersion={APP_VERSION}
							isStandalone={isStandalone}
							onGetStarted={() => setSettingsOpen('CreateUsernamePinScreen')}
							onRestoreWallet={() => setSettingsOpen('RestoreWalletScreen')}
						/>
					)) : !isInitialEntry ? ((hasCheckedUrl && !redeemFromUrl) ? null : (
					<>
						{/* Card Active 成功画面：redeem 完成后显示 */}
						{redeemFromUrl && !redeeming && redeemResult?.success ? (
							<div className="w-full max-w-lg mx-auto px-6 md:px-8 min-h-full flex flex-col pt-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
								{/* Success Header */}
								<div className="flex flex-col items-center mb-8">
									<div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-[#1562f0] to-[#0e4cbb] shadow-lg shadow-[#1562f0]/35 mb-6">
										<Check size={32} className="text-white" strokeWidth={4} />
									</div>
									<h1 className="text-[32px] font-bold text-slate-900 tracking-tight text-center leading-tight">{tu('card_active')}</h1>
									<p className="text-slate-500 font-medium mt-2">{tu('redemption_complete_funds_available')}</p>
								</div>

								{/* CCSA 卡片 + READY badge */}
								<div className="w-full max-w-[340px] mx-auto mb-10 relative">
									<div className="rounded-[24px] overflow-hidden shadow-2xl relative" style={{ aspectRatio: '1.58 / 1' }}>
										<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
										<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
										<div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -30px 70px rgba(0,0,0,0.42)' }} />
										<div className="relative z-10 p-5 h-full flex flex-col justify-between">
											<div className="flex justify-between items-start">
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)', boxShadow: '0 14px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.38)' }}>
														<Globe className="h-5 w-5 text-white drop-shadow" />
													</div>
													<div>
														<div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div>
														<div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 drop-shadow-sm font-serif">CARD</div>
													</div>
												</div>
												<div className="flex flex-col items-end gap-1.5">
													<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs text-white font-semibold flex items-center gap-1">
														<Globe size={10} className="text-white" /> Membership
													</div>
													<div className="bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-[#1562f0]/30 flex items-center gap-1">
														<Zap size={10} fill="currentColor" /> READY
													</div>
												</div>
											</div>
											<div className="flex items-end justify-between gap-2 min-w-0">
												<div>
													<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-[#fff2c6]">{tu('balance')}</p>
													<div className="flex items-baseline gap-1">
														{/* 2. 展示兜底：ccsaAssets 为空（getMyAssets 请求中/失败）但 redeem 已成功时，用 redeemDetails.pointsHuman */}
														<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">{formatWithThousands(ccsaAssets?.points ?? (redeemResult?.success && redeemDetails?.pointsHuman ? redeemDetails.pointsHuman : '0'))}</span>
														<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">CAD</span>
													</div>
												</div>
												{(() => {
													const nft = ccsaAssets?.nfts?.find((n) => Number(n.tokenId) >= ISSUED_NFT_START_ID)
														?? ccsaAssets?.nfts?.find((n) => Number(n.tokenId) > 0)
													const memberNo = nft ? formatMemberNo(nft.tokenId) : null
													if (!memberNo) return null
													return (
														<div className="relative font-mono text-[10px] tracking-[0.2em] uppercase font-semibold shrink-0 pb-0.5">
															<span className="absolute inset-0 text-black/45 translate-y-[1px]">MEMBER&nbsp;NO.&nbsp;{memberNo}</span>
															<span className="relative text-[#f5fffd] block">MEMBER&nbsp;NO.&nbsp;{memberNo}</span>
														</div>
													)
												})()}
											</div>
										</div>
									</div>
								</div>

								{/* Go To Home */}
								<div className="mt-auto space-y-3">
									<AppButton
										loading={loading}
										fullWidth
										onClick={() => {
											window.location.reload()
										}}
										className="h-16 rounded-full text-base font-bold uppercase tracking-wide bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] hover:opacity-[0.96] text-white shadow-[0_12px_30px_rgba(21,98,240,0.35)] focus-visible:!ring-2 focus-visible:!ring-[#1562f0]/75 focus-visible:!ring-offset-2"
									>
										Go To Home
									</AppButton>
								</div>
							</div>
						) : (
						/* Wallet Ready - redeem 进行中或非 redeem 流程 */
						<div className="w-full max-w-lg mx-auto px-6 md:px-8 min-h-full flex flex-col">
							{/* Header: Logo + CashTrees Wallet + VAULT ACTIVE */}
							<div className="flex items-center justify-between pt-6 pb-4">
								<div className="flex items-center gap-1.5">
									<IpfsImg
										src={VERRA_BRAND_LOGO_SRC}
										alt=""
										className="h-[72px] w-[72px] object-contain shrink-0 select-none"
										draggable={false}
									/>
									<span className="text-base font-semibold text-slate-900 dark:text-slate-100">
										CashTrees Wallet
									</span>
								</div>
								<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1562f0]/12 dark:bg-[#1562f0]/25 text-[#1562f0] dark:text-[#6ba3ff] text-xs font-semibold">
									<Check className="w-3.5 h-3.5" strokeWidth={3} />
									VAULT ACTIVE
								</span>
							</div>

							<h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
								CCSA Ready
							</h1>
							<p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
								Self-custodial USDC on Base — you control your funds.
							</p>

							{/* CCSA 卡片 */}
							<div className="rounded-[24px] overflow-hidden shadow-lg mb-4 relative" style={{ aspectRatio: '1.58 / 1' }}>
								<IpfsImg src={ccsabackphoto} alt={tu('ccsa_card')} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
								<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
								<div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -30px 70px rgba(0,0,0,0.42)' }} />
								<div className="relative z-10 p-5 h-full flex flex-col justify-between">
									<div className="flex justify-between items-start">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)', boxShadow: '0 14px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.38)' }}>
												<Globe className="h-5 w-5 text-white drop-shadow" />
											</div>
											<div>
												<div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div>
												<div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 drop-shadow-sm font-serif">CARD</div>
											</div>
										</div>
										<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
											<Globe size={10} className="text-white" /> Membership
										</div>
									</div>
									<div className="flex items-end justify-between gap-2 min-w-0">
										<div>
											<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5">{tu('balance')}</p>
											<div className="flex items-baseline gap-1">
												{redeeming ? (
													<Loader className="w-6 h-6 text-[#fff2c6] animate-spin" strokeWidth={2.5} />
												) : (
													<>
														{/* 2. 展示兜底：ccsaAssets 为空（getMyAssets 请求中/失败）但 redeem 已成功时，用 redeemDetails.pointsHuman */}
														<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">
															{formatWithThousands(
																ccsaAssets?.points ?? (redeemResult?.success && redeemDetails?.pointsHuman ? redeemDetails.pointsHuman : '0')
															)}
														</span>
														<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">CAD</span>
													</>
												)}
											</div>
										</div>
										{(() => {
											// 优先取 issued NFT (tokenId >= 1e11)，否则取任一 tier NFT (tokenId > 0)
											const nft = ccsaAssets?.nfts?.find((n) => Number(n.tokenId) >= ISSUED_NFT_START_ID)
												?? ccsaAssets?.nfts?.find((n) => Number(n.tokenId) > 0)
											const memberNo = nft ? formatMemberNo(nft.tokenId) : null
											if (!memberNo || redeeming) return null
											return (
												<div className="relative font-mono text-[10px] tracking-[0.2em] uppercase font-semibold shrink-0 pb-0.5">
													<span className="absolute inset-0 text-black/45 translate-y-[1px]">MEMBER&nbsp;NO.&nbsp;{memberNo}</span>
													<span className="relative text-[#f5fffd] block">MEMBER&nbsp;NO.&nbsp;{memberNo}</span>
												</div>
											)
										})()}
									</div>
								</div>
							</div>

							{/* Reward Received Card */}
							{redeemFromUrl && (
								<div className="rounded-2xl bg-[#1562f0]/08 dark:bg-[#1562f0]/15 border border-[#1562f0]/18 dark:border-[#1562f0]/35 p-4 mb-4 flex items-start gap-3">
									<div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1562f0] to-[#0e4cbb] flex items-center justify-center shrink-0 shadow-md shadow-[#1562f0]/25">
										{redeemDetailsLoading || redeeming ? (
											<Loader className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
										) : (
											<Gift className="w-5 h-5 text-white" strokeWidth={2.5} />
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">{tu('reward_received')}</div>
										<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 leading-snug">
											{redeemDetails ? (() => {
												const pts = Number(redeemDetails.pointsHuman)
												const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
												const amt = ptsPer1 ? pts / ptsPer1 : pts
												const amtStr = `${fiatPrefix(redeemDetails.currency as any)}${formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)}`
												return redeeming
													? `Redeeming ${amtStr}...`
													: `A ${amtStr} Welcome Voucher from CCSA has been added to your card pack.`
											})() : redeemDetailsLoading ? tu('loading_2') : 'A Welcome Voucher has been added to your card pack.'}
										</p>
									</div>
									<ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" strokeWidth={2.5} />
								</div>
							)}

							{/* GO TO HOME Button */}
							{!redeeming && (
								<div className="mt-auto pb-4">
									<AppButton
										loading={loading}
										fullWidth
										onClick={() => {
											window.location.reload()
										}}
										className="h-[56px] rounded-2xl text-base font-bold uppercase tracking-wide bg-gradient-to-r from-[#1562f0] to-[#0e4cbb] hover:opacity-[0.96] text-white shadow-[0_12px_30px_rgba(21,98,240,0.35)] focus-visible:!ring-2 focus-visible:!ring-[#1562f0]/75 focus-visible:!ring-offset-2"
									>
										Go To Home
									</AppButton>
								</div>
							)}
						</div>
						)}
					</>)) : null
				}
				
			</div>
			<AnimatePresence>
				{settingsOpen && (
					<motion.div
						className="
							fixed inset-0 z-[9998]
							bg-white dark:bg-slate-900
							flex flex-col min-h-0
						"
						
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
						{/* RecoveryQR / Welcome / Wallet ready / Create Verra ID / Restore 无 BeamioNavBack；其余子页用顶栏 */}
						{settingsOpen !== 'RecoveryQRScreen' &&
							settingsOpen !== 'OnboardingWelcomeScreen' &&
							settingsOpen !== 'WalletReadyScreen' &&
							settingsOpen !== 'RestoreWalletScreen' &&
							settingsOpen !== 'ActiveCouponsScreen' &&
							settingsOpen !== 'RedeemVoucherScreen' &&
							settingsOpen !== 'CreateUsernamePinScreen' &&
							(
							<div className="relative shrink-0 z-[100]" style={{ minHeight: TOP_OFFSET }}>
								<BeamioNavBack
									title=''
									onClose={() => {
										if (settingsOpen === 'CreateUsernamePinScreen') {
											const handled = createUsernameRef.current?.goBack()
											if (!handled) setSettingsOpen('')
										} else setSettingsOpen('')
									}}
									showMore={false}
									onMore={() => {}}
								/>
							</div>
						)}

					{/* 内容区域；Security Backup / Welcome / Create Verra ID 单屏 flex，禁用外层滚动条 */}
						<div
							className={
								settingsOpen === 'RecoveryQRScreen' ||
								settingsOpen === 'OnboardingWelcomeScreen' ||
								settingsOpen === 'WalletReadyScreen' ||
								settingsOpen === 'CreateUsernamePinScreen' ||
								settingsOpen === 'RestoreWalletScreen' ||
								settingsOpen === 'ActiveCouponsScreen' ||
								settingsOpen === 'RedeemVoucherScreen'
									? 'flex min-h-0 flex-1 flex-col overflow-hidden'
									: 'min-h-0 flex-1 overflow-y-auto'
							}
						>
							
							{
								settingsOpen === 'CreateUsernamePinScreen' && <CreateUsernamePinScreen ref={createUsernameRef} isRedeemFlow={!!redeemFromUrl} onRequestClose={() => setSettingsOpen('')} onCreatingWalletChange={setCreateWalletLoading} close={qr => {
									setQrDataUrl(qr.qrDataUrl)
									setRecoveryCode(qr.passcode)
									setBeamioTag(qr.beamioTag ?? '')
									setTemp(qr.temp)
									if (redeemFromUrl) {
										setRedeemActivating(true)
										setRedeemPostCreateInProgress(true)
									}
									setSettingsOpen('RecoveryQRScreen')
								}} />
							}

							{
								settingsOpen === 'RecoveryQRScreen' && <RecoveryQRScreen
									qrDataUrl={qrDataUrl}
									recoveryCode={recoveryCode}
									showButton={true}
									beamioTag={beamioTag || undefined}
									isRedeemFlow={!!redeemFromUrl}
									redeemActivating={redeemActivating}
									close={redeemFromUrl ? () => {
										// redeem 流程下 init+redeem 已在进入时完成，此处仅关闭
										setSettingsOpen('')
									} : async () => {
										await init(temp, { dontClose: true })
										const profile = CoNET_Data?.profiles?.[0]
										if (profile?.keyID && ethers.isAddress(profile.keyID)) {
											void ensureConetAaForProfileAndPersist(profile, setProfiles).then((aa) => {
												if (aa) setWalletAddr(aa)
											})
										}
										setSettingsOpen('OnboardingWelcomeScreen')
									}} />
							}
							{
								settingsOpen === 'OnboardingWelcomeScreen' && (
									<OnboardingWelcomeScreen
										beamioTag={beamioTag || undefined}
										onEnterHome={() => void handleOnboardingEnterHome()}
									/>
								)
							}
							{
								settingsOpen === 'WalletReadyScreen' && (
									<WalletReadyScreen
										usdcBalance={formatWithThousands(usdcBal || '0')}
										onCashierTopUp={() => {
											try {
												sessionStorage.setItem(WALLET_READY_INTENT_KEY, 'activate')
											} catch {
												/* ignore */
											}
											home()
											navigate('/')
										}}
										onNfcSync={() => {
											try {
												sessionStorage.setItem(WALLET_READY_INTENT_KEY, 'nfcSync')
											} catch {
												/* ignore */
											}
											home()
											navigate('/')
										}}
										onRedeemGiftVoucher={() => {
											setSettingsOpen('ActiveCouponsScreen')
										}}
										onFinishLater={() => home()}
										address={eoaAddress || undefined}
										balanceFiat={formatAmount(parseFloat(usdcBal || '0') || 0, 'CAD')}
										beamioTag={beamioTag || undefined}
									/>
								)
							}
							{
								settingsOpen === 'ActiveCouponsScreen' && (
									<ActiveCouponsScreen
										onBack={() => setSettingsOpen('WalletReadyScreen')}
										onManualEntry={() => setSettingsOpen('RedeemVoucherScreen')}
										getPrivateKeyArmor={() =>
											resolveSigningPrivateKeyArmor(CoNET_Data?.profiles?.[0] ?? temp?.profiles?.[0]) ||
											undefined
										}
										onWalletUnlock={() => navigate('/settings')}
										onClaimSuccess={() => {
											home()
											navigate('/')
										}}
									/>
								)
							}
							{
								settingsOpen === 'RedeemVoucherScreen' && (
									<RedeemVoucherScreen
										onBack={() => setSettingsOpen('ActiveCouponsScreen')}
										onActivateVoucher={(voucherInput) => {
											const path = buildRedeemVoucherHistoryPath(voucherInput)
											if (!path) return
											home()
											navigate(path)
										}}
									/>
								)
							}
							{
								settingsOpen === 'RestoreWalletScreen' && (
									<RestoreWalletUnifiedScreen
										initialRecoveryCode={restoreFromUrlMasterKey}
										initialBeamioTag={
											beamioTagFromUrlSearch() ||
											knownBeamioAccountNameFromStorage(CoNET_Data) ||
											beamioTag.trim().replace(/^@+/, '')
										}
										onClose={() => {
											if (requireWalletRecover || consumerAppNeedsWalletRecover(CoNET_Data)) return
											setSettingsOpen('')
											setRestoreFromUrlMasterKey('')
										}}
										onRestore={async ({ temp, qrDataUrl, recoveryCode, beamioTag }) => {
											setRestoreFromUrlMasterKey('')
											if (!hasLocalPlaintextMnemonic(temp)) {
												return
											}
											if (requireWalletRecover) {
												await init(temp)
												home()
												return
											}
											setTemp(temp)
											setQrDataUrl(qrDataUrl)
											setRecoveryCode(recoveryCode)
											setBeamioTag(beamioTag || temp?.beamio?.accountName || '')
											setSettingsOpen('RecoveryQRScreen')
										}}
									/>
								)
							}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

		</div>
	)
}
