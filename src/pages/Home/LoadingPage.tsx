import React, { useEffect, useState, useRef } from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe, ArrowLeft, ShieldCheck, AlertTriangle, X, Building2, Server, Settings, BadgeCheck } from "lucide-react"
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


	const InitialEntryScreen = () => (
		<div
			className="
				min-h-[100dvh] w-full flex flex-col relative text-[#2c2f31]
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
			style={{
				backgroundColor: '#ffffff',
				backgroundImage: `
					radial-gradient(at 100% 0%, rgba(0, 81, 209, 0.05) 0px, transparent 50%),
					radial-gradient(at 0% 100%, rgba(122, 157, 255, 0.05) 0px, transparent 50%)
				`,
			}}
		>
			{APP_VERSION && (
				<div className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-6 z-10 text-[11px] text-[#abadaf] font-medium">
					v{APP_VERSION}
				</div>
			)}

			{/* Mobile header — matches newOnloading.html */}
			<header className="px-6 pt-8 pb-2 lg:hidden shrink-0">
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 bg-[#0051d1] rounded-lg flex items-center justify-center text-[#f1f2ff] shrink-0">
						<Building2 className="w-[18px] h-[18px]" strokeWidth={2.25} aria-hidden />
					</div>
					<span className="text-[#0051d1] font-bold tracking-tight text-xl" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
						Verra Business
					</span>
				</div>
			</header>

			<main className="flex-1 flex items-center justify-center px-6 py-6 lg:py-12 min-h-0 w-full">
				<div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
					{/* Left: editorial */}
					<div className="flex flex-col space-y-8 lg:pr-12">
						<div className="space-y-6">
							<div className="hidden lg:flex items-center gap-2 mb-1">
								<div className="w-10 h-10 bg-[#0051d1] rounded-lg flex items-center justify-center text-[#f1f2ff] shrink-0">
									<Building2 className="w-6 h-6" strokeWidth={2.25} aria-hidden />
								</div>
								<span className="text-[#0051d1] font-extrabold tracking-tight text-2xl" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
									Verra Business
								</span>
							</div>
							<h1
								className="font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight text-[#2c2f31]"
								style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
							>
								Set up your business for <span className="text-[#0051d1]">live commerce</span>.
							</h1>
							<p className="text-[#595c5e] text-base lg:text-lg leading-relaxed max-w-md">
								Create your Verra Business workspace to issue membership cards, manage customer balance, and run branded payments in one place.
							</p>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
							<div className="p-6 lg:p-8 rounded-2xl bg-[#eef1f3]/40 border border-[#d9dde0]/40 space-y-3">
								<Settings className="w-6 h-6 text-[#0051d1]" strokeWidth={1.75} aria-hidden />
								<h3 className="font-bold text-[#2c2f31]">Business Control</h3>
								<p className="text-sm text-[#595c5e] leading-relaxed">Manage cards, balance, and approvals in one place.</p>
							</div>
							<div className="p-6 lg:p-8 rounded-2xl bg-[#eef1f3]/40 border border-[#d9dde0]/40 space-y-3">
								<BadgeCheck className="w-6 h-6 text-[#0051d1]" strokeWidth={1.75} aria-hidden />
								<h3 className="font-bold text-[#2c2f31]">Brand Identity</h3>
								<p className="text-sm text-[#595c5e] leading-relaxed">Use a trusted business handle across Verra.</p>
							</div>
						</div>

						<div className="hidden lg:block relative rounded-2xl overflow-hidden aspect-video border border-[#d9dde0]/25 bg-gradient-to-b from-[#f8faff] to-[#eff4ff]">
							<div
								className="absolute h-px w-full bg-gradient-to-r from-transparent via-[#0051d1]/10 to-transparent"
								style={{ top: '30%' }}
							/>
							<div
								className="absolute h-px w-full bg-gradient-to-r from-transparent via-[#0051d1]/10 to-transparent opacity-50"
								style={{ top: '60%' }}
							/>
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="flex gap-3">
									<div className="w-12 h-1 bg-[#0051d1]/10 rounded-full" />
									<div className="w-24 h-1 bg-[#0051d1]/20 rounded-full" />
									<div className="w-16 h-1 bg-[#0051d1]/10 rounded-full" />
								</div>
							</div>
							<div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white/40 to-transparent">
								<span className="text-[#0051d1]/60 font-bold tracking-wide uppercase text-[10px]">Verra Workspace Infrastructure</span>
							</div>
						</div>
					</div>

					{/* Right: glass card + actions */}
					<div className="w-full max-w-md mx-auto lg:mx-0">
						<div
							className="
								p-6 sm:p-8 lg:p-10 rounded-2xl shadow-[0_12px_40px_rgba(0,81,209,0.04)]
								border border-[#d9dde0]/25
								bg-white/95 backdrop-blur-xl
							"
						>
							<div className="mb-8">
								<div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
									<span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0051d1] bg-[#0051d1]/5 px-3 py-1 rounded-full">
										Step 1 of 2
									</span>
									<span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#abadaf]">Business Identity</span>
								</div>
								<h2 className="font-bold text-2xl text-[#2c2f31] mb-3" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
									Create your business identity
								</h2>
								<p className="text-[#595c5e] text-sm leading-relaxed">
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
												rounded-full py-4 text-base font-semibold
												bg-white border border-[#d9dde0]/80 text-[#2c2f31]
												shadow-sm hover:bg-[#f5f7f9]
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
					</div>
				</div>
			</main>

			<footer className="w-full max-w-screen-xl mx-auto px-6 py-8 lg:py-10 mt-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[#747779] text-[10px] font-bold uppercase tracking-widest border-t border-transparent">
				<div className="flex items-center gap-2 text-center md:text-left">
					<Server className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
					<span>Securely hosted by Beamio Infrastructure © 2026</span>
				</div>
				<div className="flex flex-wrap justify-center gap-6 md:gap-8">
					<a className="hover:text-[#0051d1] transition-colors" href="https://beamio.app/privacy" target="_blank" rel="noopener noreferrer">
						Privacy Policy
					</a>
					<a className="hover:text-[#0051d1] transition-colors" href="https://beamio.app/terms" target="_blank" rel="noopener noreferrer">
						Terms of Service
					</a>
					<a className="hover:text-[#0051d1] transition-colors" href="https://beamio.app" target="_blank" rel="noopener noreferrer">
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
						{/* 顶部 Header：占据空间，确保不被内容遮挡，返回按钮可点击 */}
						<div className="relative shrink-0 z-[100]" style={{ minHeight: TOP_OFFSET }}>
							<BeamioNavBack
								title=''
								onClose={() => {
									if (settingsOpen === 'RecoveryQRScreen') setSettingsOpen('')
									else if (settingsOpen === 'RestoreWithQRScreen' || settingsOpen === 'RestoreWithUsernamePinScreen') setSettingsOpen('RestoreEntryScreen')
									else setSettingsOpen('')
								}}
								showMore={false}
								onMore={() => {}}
							/>
						</div>

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
