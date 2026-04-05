import React, { useEffect, useState, useRef } from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe, ArrowLeft, ShieldCheck, AlertTriangle, X, Building2, Cloud } from "lucide-react"
import { getAAAccount, getRedeemDetailsForDisplay, postCardRedeem, postCardRedeemAdmin, getMyAssets, checkRedeemAdminCodeValid, isCardAdmin } from "@/services/BeamioCard"
import { initChat}from '@/services/chat'

import { getUsdcBalanceFromApi, formatWithThousands, isStandalone } from "@/services/beamio"
import { ethers } from "ethers"
import { BASE_MAINNET_FACTORIES } from "@/config/chainAddresses"
import { updateManifestStartUrl } from "@/utils/updateManifestStartUrl"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { getUserInfo, storeSystemData, checkStorage, restoreWithRedeem } from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import BusinessIdentityForm from './BusinessIdentityForm'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import RestoreWithQRScreen from './RestoreWithQRScreen'
import RestoreWithUsernamePinScreen from './RestoreWithUsernamePinScreen'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl'
import { bizBrandFocusRingClass } from '@/pages/Home/brandUi'

const APP_VERSION = (packageJson as { version?: string }).version ?? ''
const ISSUED_NFT_START_ID = 100_000_000_000

/** 从 NFT tokenId 推导卡号显示：issued NFT 用序号，tier NFT 用 tokenId */
function formatMemberNo(tokenId: string | number): string {
	const n = Number(tokenId)
	if (n >= ISSUED_NFT_START_ID) {
		return `M-${String(n - ISSUED_NFT_START_ID + 1).padStart(6, '0')}`
	}
	return `M-${String(n).padStart(6, '0')}`
}

// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
	onInitComplete?: () => void
}

const TOP_OFFSET = "calc(env(safe-area-inset-top) + 4rem)"




export default function BeamioOnboardingModal({home, onInitComplete}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, 
		setAllNodes, setGossip, gossip,
		setIsInitialLoading, myAddress, setMyAddress, usdcbalance, setShowFooter, setCharts } = useDaemonContext()
	const [walletAddr, setWalletAddr] = useState('')
	const [usdcBal, setUsdcBal] = useState('0')
	const [eoaAddress, setEoaAddress] = useState('')
	const [loading, SetLoading] = useState(true)
	const navigate = useNavigate()

	const [settingsOpen, setSettingsOpen] = useState<''|'RecoveryQRScreen'|'RestoreEntryScreen'|'RestoreWithQRScreen'|'RestoreWithUsernamePinScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(true)
	const [qrDataUrl, setQrDataUrl] = useState('')
	const [recoveryCode, setRecoveryCode]  = useState('')
	const [beamioTag, setBeamioTag] = useState('')
	const [temp, setTemp] = useState<any>()

	// Redeem from URL (beamiocard + redeemcode)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress: string; redeemCode: string } | null>(null)
	const [hasCheckedUrl, setHasCheckedUrl] = useState(false)
	/** 从 URL 的 MasterKey 参数进入的 recover 模式，restore 失败时预填到 RestoreWithQRScreen */
	const [restoreFromUrlMasterKey, setRestoreFromUrlMasterKey] = useState('')
	const [redeemDetails, setRedeemDetails] = useState<import('@/services/BeamioCard').RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [redeeming, setRedeeming] = useState(false)
	const [redeemDone, setRedeemDone] = useState(false)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [ccsaAssets, setCcsaAssets] = useState<{ points: string; nfts: { tokenId: string }[] } | null>(null)
	const redeemHandledByRecoveryRef = useRef(false)
	const homeCalledRef = useRef(false)
	const [redeemActivating, setRedeemActivating] = useState(false)
	const [redeemPostCreateInProgress, setRedeemPostCreateInProgress] = useState(false)


	const init = async (temp?: encrypt_keys_object, opts?: { dontClose?: boolean }) => {

		const isAcc = await checkStorage()
		if (!isAcc) {
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			onInitComplete?.()
			return
		}

		temp = temp||isAcc
	
		const profiles = temp?.profiles
		

		
		if (!temp || !profiles ) {
			setIsInitialLoading(true)
			setIsInitialEntry(true)
			onInitComplete?.()
			return
		}

		setProfiles(profiles)

		
		const loadUserInfo = (): Promise<beamio> => new Promise(async (resolve) => {
			const userInfo = await getUserInfo(profiles[0].keyID)
			if (!userInfo) {
				return setTimeout(async () => {
					return resolve(await loadUserInfo())
				}, 1000)
			}
			return resolve(userInfo)
		})
			
		const userInfo = await loadUserInfo()
		if (!userInfo) return
		
		const bo: beamio = userInfo

		SetLoading(true)
		initChat(setProfiles, setAllNodes, setGossip, gossip, message => {
			setCharts((prev: string[]) => [...prev, message])
		})
		
		bo.initialLoading = true
		
		
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
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


	const headlineFont = { fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" } as const

	const InitialEntryScreen = () => (
		<div
			className="
				min-h-[100dvh] w-full flex flex-col relative bg-white text-[#121212]
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
		>
			{APP_VERSION && (
				<div className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-6 z-10 text-[11px] text-[#abadaf] font-medium">
					v{APP_VERSION}
				</div>
			)}

			{/* Mobile header — matches newOnloading.html */}
			<header className="shrink-0 px-8 pt-8 pb-2 lg:px-12 lg:hidden">
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1562F0] text-white">
						<Building2 className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
					</div>
					<span className="text-xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
						Verra Business
					</span>
				</div>
			</header>

			<main className="min-h-0 w-full flex-1">
				<div className="mx-auto grid min-h-[80vh] w-full max-w-[1440px] grid-cols-1 items-stretch lg:grid-cols-[40%_60%]">
					{/* Left: brand + editorial (screenshot sidebar) */}
					<section className="relative flex flex-col items-center justify-center overflow-hidden border-[#E5E7EB] px-8 py-12 lg:border-r lg:bg-[#F9FAFB]/90 lg:px-12 lg:py-20 xl:px-20">
						<div
							className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(21,98,240,0.03)_0%,transparent_70%)] lg:block"
							aria-hidden
						/>
						<div className="relative z-10 flex w-full max-w-xl flex-col items-center space-y-10 text-center">
							<div className="w-full space-y-6">
								<div className="mb-1 hidden items-center justify-center gap-2 lg:flex">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#1562F0] text-white">
										<Building2 className="h-6 w-6" strokeWidth={2.25} aria-hidden />
									</div>
									<span className="text-2xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
										Verra Business
									</span>
								</div>
								<h1
									className="text-4xl font-extrabold leading-[1.15] tracking-tight text-[#121212] lg:text-5xl"
									style={headlineFont}
								>
									Set up your business for <span className="text-[#1562F0]">live commerce</span>.
								</h1>
								<p className="mx-auto max-w-md text-base leading-relaxed text-[#666666] lg:text-lg">
									Create your Verra Business workspace to issue membership cards, manage customer balance, and run branded payments in
									one place.
								</p>
							</div>

							<div className="flex w-full flex-col gap-4">
								<div className="space-y-1 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
									<h3 className="font-bold text-[#121212]">Business Control</h3>
									<p className="text-sm leading-relaxed text-[#666666]">Manage cards, balance, and approvals in one place.</p>
								</div>
								<div className="space-y-1 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
									<h3 className="font-bold text-[#121212]">Brand Identity</h3>
									<p className="text-sm leading-relaxed text-[#666666]">Use a trusted business handle across Verra.</p>
								</div>
							</div>

							<div className="hidden w-full justify-center pt-2 lg:flex" aria-hidden>
								<div
									className="h-0.5 w-[120px] rounded-full opacity-15"
									style={{
										background: "linear-gradient(90deg, #1562F0 0%, transparent 100%)",
									}}
								/>
							</div>
						</div>
					</section>

					{/* Right: form column — flush white, no glass card */}
					<section className="flex flex-col justify-center px-8 py-12 lg:px-16 lg:py-20 xl:px-24">
						<div className="mx-auto w-full max-w-lg lg:mx-0">
							<div className="mb-10">
								<h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#121212]" style={headlineFont}>
									Create your business identity
								</h2>
								<p className="leading-relaxed text-[#666666]">
									Choose your Verra handle and set the password that protects your business workspace.
								</p>
							</div>

							{isStandalone && (
								<div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/80">
									<p className="text-[13px] font-medium text-amber-900 leading-snug">
										Opened from home screen? Wallet data from Safari doesn&apos;t transfer. Use <strong>Restore Wallet</strong> below.
									</p>
								</div>
							)}

							<BusinessIdentityForm
								isRedeemFlow={!!redeemFromUrl}
								showIntroHeader={false}
								onSuccess={(qr) => {
									setQrDataUrl(qr.qrDataUrl)
									setRecoveryCode(qr.passcode)
									setBeamioTag(qr.beamioTag ?? '')
									setTemp(qr.temp)
									if (redeemFromUrl) {
										setRedeemActivating(true)
										setRedeemPostCreateInProgress(true)
									}
									setSettingsOpen('RecoveryQRScreen')
								}}
								trailingAfterSubmit={
									<>
										<AppButton
											fullWidth
											variant="secondary"
											className={`
												rounded-xl border border-[#E5E7EB] bg-white py-4 text-base font-semibold text-[#121212]
												shadow-sm hover:bg-[#F9FAFB]
												${bizBrandFocusRingClass}
											`}
											onClick={() => setSettingsOpen('RestoreEntryScreen')}
										>
											Restore Wallet
										</AppButton>
										<p className="text-center text-[11px] text-[#abadaf] font-medium pt-1">Gas sponsored. Non-custodial.</p>
									</>
								}
							/>
						</div>
					</section>
				</div>
			</main>

			<footer className="mx-auto mt-auto flex w-full max-w-screen-xl flex-col items-center justify-between gap-6 border-t border-transparent px-8 py-10 text-[10px] font-bold uppercase tracking-[0.2em] text-[#666666]/50 md:flex-row lg:px-12">
				<div className="flex items-center gap-2 text-center md:text-left">
					<Cloud className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
					<span>Securely hosted by Beamio Infrastructure © 2026</span>
				</div>
				<div className="flex flex-wrap justify-center gap-8 md:gap-8">
					<a className="transition-colors hover:text-[#1562F0]" href="https://beamio.app/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="https://beamio.app/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="transition-colors hover:text-[#1562F0]" href="https://beamio.app" target="_blank" rel="noopener noreferrer">
						Help Center
					</a>
				</div>
			</footer>
		</div>
	)


	
	// 首次进入（无钱包）时显示 Create/Restore 入口
	if (isInitialEntry && !settingsOpen) {
		return <InitialEntryScreen />
	}

	return (
		<div className="
				min-h-screen w-full bg-white dark:bg-slate-900
				/* 👇 安全区补偿 */
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]

		">
			<div className="min-h-screen">
				
				
				
			</div>
			<AnimatePresence>
				{settingsOpen && (
					<motion.div
						className="
							fixed inset-0 z-[9998]
							bg-white dark:bg-slate-900
							flex flex-col
						"
						
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
						{/* RecoveryQRScreen 自带顶栏；其余子屏仍用 BeamioNavBack */}
						{settingsOpen !== 'RecoveryQRScreen' && (
							<div className="relative z-[100] shrink-0" style={{ minHeight: TOP_OFFSET }}>
								<BeamioNavBack
									title=""
									onClose={() => {
										if (settingsOpen === 'RestoreWithQRScreen' || settingsOpen === 'RestoreWithUsernamePinScreen')
											setSettingsOpen('RestoreEntryScreen')
										else setSettingsOpen('')
									}}
									showMore={false}
									onMore={() => {}}
								/>
							</div>
						)}

					{/* 内容区域 */}
						<div 
							className="flex-1 overflow-y-auto min-h-0"
						>
							
							{
								settingsOpen === 'RecoveryQRScreen' && <RecoveryQRScreen
									qrDataUrl={qrDataUrl}
									recoveryCode={recoveryCode}
									showButton={true}
									beamioTag={beamioTag || undefined}
									isRedeemFlow={!!redeemFromUrl}
									redeemActivating={redeemActivating}
									onBack={() => setSettingsOpen('')}
									close={redeemFromUrl ? () => {
										// redeem 流程下 init+redeem 已在进入时完成，此处仅关闭
										setSettingsOpen('')
									} : async () => {
										await init(temp, { dontClose: true })
										// URL 带 redeemAdmin + redeemCode 时：校验 code 有效、EOA 非 admin 后，向 endpoint 完成 redeem admin
										const redeemAdminParams = parseRedeemAdminFromUrl()
										if (redeemAdminParams) {
											const userEOA = temp?.profiles?.[0]?.keyID?.trim()
											if (userEOA && ethers.isAddress(userEOA)) {
												const valid = await checkRedeemAdminCodeValid(redeemAdminParams.cardAddress, redeemAdminParams.redeemCode)
												if (!valid) {
													console.warn('[RecoveryQRScreen] redeemAdmin code invalid or expired, skip')
												} else {
													const alreadyAdmin = await isCardAdmin(redeemAdminParams.cardAddress, userEOA)
													if (alreadyAdmin) {
														console.warn('[RecoveryQRScreen] EOA already admin, skip redeem')
													} else {
														const res = await postCardRedeemAdmin(
															redeemAdminParams.cardAddress,
															redeemAdminParams.redeemCode,
															userEOA
														)
														if (!res.success && res.error) {
															console.warn('[RecoveryQRScreen] redeemAdmin failed:', res.error)
														}
													}
												}
											}
										}
										home()
									}} />
							}
							
							{
								settingsOpen === 'RestoreEntryScreen' && <RestoreEntryScreen onUseRecoveryQR={() => {
									setSettingsOpen('RestoreWithQRScreen')
								}} onUseUsernamePin={() => {
									setSettingsOpen('RestoreWithUsernamePinScreen')
								}} />
							}
							{
								settingsOpen === 'RestoreWithQRScreen' && <RestoreWithQRScreen
									initialRecoveryCode={restoreFromUrlMasterKey}
									onRestore={async (temp) => {
										setSettingsOpen('')
										setRestoreFromUrlMasterKey('')
										await init(temp)
										home()
									}} />
							}
							{
								settingsOpen === 'RestoreWithUsernamePinScreen' && <RestoreWithUsernamePinScreen onRestore={async (temp) => {
									setSettingsOpen('')
									await init(temp)
									home()
								}} />
							}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

		</div>
	)
}
