import React, {useEffect, useState} from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe } from "lucide-react"
import { getAAAccount, getRedeemDetailsForDisplay, postCardRedeem, getMyAssets } from "@/services/BeamioCard"
import { getUsdcBalanceFromApi, formatWithThousands } from "@/services/beamio"
import { ethers } from "ethers"
import { CCSA_Card_Address } from "@/utils/constants"
import { fiatPrefix, formatAmount } from "@/services/currency"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { getUserInfo, storeSystemData, checkStorage} from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import CreateUsernamePinScreen from './CreateUsernamePinScreen'
import RecoveryQRScreen from './RecoveryQRScreen'
import InstallTerminalSheet, { getInstallTerminalSeen } from '@/components/InstallTerminalSheet'
import RestoreEntryScreen from './RestoreEntryScreen'
import RestoreWithQRScreen from './RestoreWithQRScreen'
import RestoreWithUsernamePinScreen from './RestoreWithUsernamePinScreen'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'

// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
	onInitComplete?: () => void
}

const TOP_OFFSET = "calc(env(safe-area-inset-top) + 4rem)"

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

export default function BeamioOnboardingModal({home, onInitComplete}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, setIsInitialLoading, myAddress, usdcbalance } = useDaemonContext()
	const [walletAddr, setWalletAddr] = useState('')
	const [usdcBal, setUsdcBal] = useState('0')
	const [loading, SetLoading] = useState(true)
	const navigate = useNavigate()

	const [settingsOpen, setSettingsOpen] = useState<''|'CreateUsernamePinScreen'|'RecoveryQRScreen'|'RestoreEntryScreen'|'RestoreWithQRScreen'|'RestoreWithUsernamePinScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(false)
	const [showInstallSheet, setShowInstallSheet] = useState(false)
	const [qrDataUrl, setQrDataUrl] = useState('')
	const [recoveryCode, setRecoveryCode]  = useState('')
	const [_temp, set_temp] = useState<any>()

	// Redeem from URL (beamiocard + redeemcode)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress: string; redeemCode: string } | null>(null)
	const [hasCheckedUrl, setHasCheckedUrl] = useState(false)
	const [redeemDetails, setRedeemDetails] = useState<import('@/services/BeamioCard').RedeemDetailsForDisplay | null>(null)
	const [redeemDetailsLoading, setRedeemDetailsLoading] = useState(false)
	const [redeeming, setRedeeming] = useState(false)
	const [redeemDone, setRedeemDone] = useState(false)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [ccsaAssets, setCcsaAssets] = useState<{ points: string; nfts: { tokenId: string }[] } | null>(null)

	const init = async (temp?: encrypt_keys_object) => {

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
		
		
		bo.initialLoading = true
		
		
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		
		setCoNET_Data(temp)
		await storeSystemData()
		SetLoading(false)
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		setSettingsOpen('')
		onInitComplete?.()
  	}

	let first = true

	useEffect(() => {
		if (first) {
			first = false
			init()
		}
	}, [])

	// 首次进入时从下滑出 Install Terminal 引导（未看过则显示）
	useEffect(() => {
		if (getInstallTerminalSeen()) return
		const t = setTimeout(() => setShowInstallSheet(true), 600)
		return () => clearTimeout(t)
	}, [])

	// 解析 URL 中的 redeem 参数
	useEffect(() => {
		const parsed = parseRedeemFromUrl()
		setRedeemFromUrl(parsed)
		setHasCheckedUrl(true)
	}, [])

	// loading ready 后：无 redeem URL 则直接进入 home
	useEffect(() => {
		if (isInitialEntry || !hasCheckedUrl || redeemFromUrl !== null || loading) return
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		home()
	}, [isInitialEntry, hasCheckedUrl, redeemFromUrl, loading, home])

	// Wallet Ready：获取 AA 地址与 USDC 余额
	useEffect(() => {
		if (isInitialEntry) return
		const profile = CoNET_Data?.profiles?.[0]
		if (!profile) return
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

	// 有 redeem URL 时拉取 redeem 详情（用于显示金额）
	useEffect(() => {
		if (!redeemFromUrl || isInitialEntry) return
		let cancelled = false
		setRedeemDetailsLoading(true)
		getRedeemDetailsForDisplay(redeemFromUrl.cardAddress, redeemFromUrl.redeemCode).then((d) => {
			if (!cancelled) setRedeemDetails(d ?? null)
		}).finally(() => {
			if (!cancelled) setRedeemDetailsLoading(false)
		})
		return () => { cancelled = true }
	}, [redeemFromUrl, isInitialEntry])

	// 有 redeem URL 时在后台执行 redeem，完成后拉取 CCSA 资产
	useEffect(() => {
		if (!redeemFromUrl || isInitialEntry) return
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
				setRedeemResult(result.success ? { success: true, tx: result.tx } : { success: false, error: result.error ?? 'Redeem failed' })
				if (result.success && profile) {
					getMyAssets(profile, CCSA_Card_Address).then((assets) => {
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


	const InitialEntryScreen = () => (
  <div
    className="
      pt-[env(safe-area-inset-top)]
      pb-[env(safe-area-inset-bottom)]
      pl-[env(safe-area-inset-left)]
      pr-[env(safe-area-inset-right)]
      w-full h-screen bg-white
    "
  >
    <div className="h-full max-w-lg mx-auto px-6 md:px-8">
      <div className="h-full flex flex-col items-center">
        {/* 上方留白（贴近截图的“更空”感觉） */}
        <div className="flex-1" />

        {/* Logo + 标题区 */}
        <div className="flex flex-col items-center text-center">
          {/* App icon */}
          <div
            className="
              w-[86px] h-[86px] rounded-[26px]
              bg-white
              ring-1 ring-slate-200/70
              shadow-[0_14px_28px_rgba(15,23,42,0.10)]
              flex items-center justify-center
            "
          >
            <span
              className="text-[44px] font-extrabold leading-none"
              style={{ color: "#1652f0" }} // Beamio Blue
            >
              B
            </span>
          </div>

          {/* Beamio */}
          <div className="mt-6 text-[44px] font-extrabold tracking-[-0.02em] text-slate-900">
            Beamio
          </div>

          {/* Slogan */}
          <div className="mt-3 text-[22px] leading-snug text-slate-500">
            The Commerce State Layer for
            USDC.
          </div>
        </div>

        {/* 按钮区 */}
        <div className="w-full mt-10">
          <AppButton
            fullWidth
            className="
              rounded-[999px] py-8 text-[18px] font-semibold
              shadow-[0_14px_30px_rgba(22,82,240,0.28)]
              active:shadow-[0_10px_20px_rgba(22,82,240,0.22)]
            "
            style={{ backgroundColor: "#1652f0" }}
            onClick={() => setSettingsOpen("CreateUsernamePinScreen")}
          >
            Create Wallet
          </AppButton>

          <div className="mt-4">
            <AppButton
              fullWidth
              variant="secondary"
              className="
                rounded-[999px] py-8 text-[18px] font-semibold
                bg-white
                border border-slate-200
                text-slate-900
                shadow-[0_10px_24px_rgba(15,23,42,0.08)]
                active:shadow-[0_7px_16px_rgba(15,23,42,0.06)]
              "
              onClick={() => setSettingsOpen("RestoreEntryScreen")}
            >
              Restore Wallet
            </AppButton>
          </div>
        </div>

        {/* 底部提示 */}
        <div className="flex-1" />
        {/* 底部提示（安全区感知） */}
			<div
			className="
				sticky bottom-0
				w-full
				pt-4
				pb-[calc(18px+env(safe-area-inset-bottom))]
				text-[18px]
				text-slate-400
				text-center
				bg-white
			"
			>
			Gas Sponsored. Non-custodial.
			</div>
      </div>
    </div>
  </div>
)


	
	return (
		<div className="

				/* 👇 安全区补偿 */
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]

		">
			<div className="">
				{
					isInitialEntry ? <InitialEntryScreen /> : (hasCheckedUrl && !redeemFromUrl) ? null : (<>
						{/* Wallet Ready - CCSA 专用：仅当有 redeem URL 时显示 */}
						<div className="w-full max-w-lg mx-auto px-6 md:px-8 min-h-full flex flex-col">
							{/* Header: Logo + Beamio Wallet + VAULT ACTIVE */}
							<div className="flex items-center justify-between pt-6 pb-4">
								<div className="flex items-center gap-2.5">
									<div className="h-9 w-9 rounded-xl bg-[#1652f0] flex items-center justify-center text-white font-bold text-lg">
										B
									</div>
									<span className="text-base font-semibold text-slate-900 dark:text-slate-100">
										Beamio Wallet
									</span>
								</div>
								<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
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

							{/* CCSA 卡片：与 MyWalletDashboardNew 相同样式，redeem 完成后显示卡号与金额 */}
							<div className="rounded-[24px] overflow-hidden shadow-lg mb-4 relative" style={{ aspectRatio: '1.58 / 1' }}>
								<img src={ccsabackphoto} alt="CCSA Card" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
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
											<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5">Balance</p>
											<div className="flex items-baseline gap-1">
												{redeeming ? (
													<Loader className="w-6 h-6 text-[#fff2c6] animate-spin" strokeWidth={2.5} />
												) : (
													<>
														<span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">
															{formatWithThousands(ccsaAssets?.points ?? '0')}
														</span>
														<span className="text-sm font-semibold opacity-90 text-[#fff2c6]">CAD</span>
													</>
												)}
											</div>
										</div>
										{(() => {
											const nft = ccsaAssets?.nfts?.find((n) => Number(n.tokenId) > 0)
											const memberNo = nft ? `M-${String(nft.tokenId).padStart(6, '0')}` : null
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

							{/* Reward Received Card - 显示 loading 与 redeem 金额 */}
							{redeemFromUrl && (
								<div className="rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/50 p-4 mb-4 flex items-start gap-3">
									<div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
										{redeemDetailsLoading || redeeming ? (
											<Loader className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
										) : (
											<Gift className="w-5 h-5 text-white" strokeWidth={2.5} />
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">REWARD RECEIVED</div>
										<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 leading-snug">
											{redeemDetails ? (() => {
												const pts = Number(redeemDetails.pointsHuman)
												const ptsPer1 = Number(redeemDetails.ptsPer1Currency)
												const amt = ptsPer1 ? pts / ptsPer1 : pts
												const amtStr = `${fiatPrefix(redeemDetails.currency as any)}${formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined)}`
												return redeeming
													? `Redeeming ${amtStr}...`
													: `A ${amtStr} Welcome Voucher from CCSA has been added to your card pack.`
											})() : redeemDetailsLoading ? 'Loading...' : 'A Welcome Voucher has been added to your card pack.'}
										</p>
									</div>
									<ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" strokeWidth={2.5} />
								</div>
							)}

							{/* Coming Soon Card */}
							{/* <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 p-4 mb-6 flex items-start gap-3">
								<div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
									<Fingerprint className="w-5 h-5 text-slate-500 dark:text-slate-400" strokeWidth={2.5} />
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">COMING SOON</div>
									<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 leading-snug">
										Biometric Auth (FaceID / TouchID)
									</p>
								</div>
								<span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 shrink-0 mt-1">
									PHASE 2
								</span>
							</div> */}

							{/* GO TO HOME Button - 仅 loading（redeem）完成后显示 */}
							{!redeeming && (
								<div className="mt-auto pb-4">
									<AppButton
										loading={loading}
										fullWidth
										onClick={() => {
											setIsInitialEntry(false)
											setIsInitialLoading(false)
											home()
										}}
										className="h-[56px] rounded-2xl text-base font-bold uppercase tracking-wide bg-[#1652f0] hover:bg-[#1345ca] text-white shadow-[0_12px_30px_rgba(22,82,240,0.3)]"
									>
										Go To Home
									</AppButton>
								</div>
							)}
						</div>
					</>)
				}
				
			</div>
			<AnimatePresence>
				{settingsOpen && (
					<motion.div
						className="
							fixed inset-0 z-40 
							bg-white dark:bg-slate-900
							flex flex-col
						"
						
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					>
						{/* 顶部 Header */}
						<BeamioNavBack
							title=''
							onClose={() => {
								setSettingsOpen('')
							}}
							showMore={false}
							onMore={() => {
								
							}}
						/>

					{/* 内容区域：放你的 BeamioAccountScreen */}
						<div 
							className="flex-1 overflow-y-auto"
							style={{ marginTop: TOP_OFFSET }}
						>
							
							{
								settingsOpen === 'CreateUsernamePinScreen' && <CreateUsernamePinScreen close={qr => {
									setQrDataUrl(qr.qrDataUrl)
									setRecoveryCode(qr.passcode)
									setSettingsOpen('RecoveryQRScreen')
									
									set_temp(qr.temp)
								}} />
							}

							{
								settingsOpen === 'RecoveryQRScreen' && <RecoveryQRScreen qrDataUrl={qrDataUrl} recoveryCode={recoveryCode} showButton={true} close={() => {
									init(_temp)
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
								settingsOpen === 'RestoreWithQRScreen' && <RestoreWithQRScreen onRestore={temp => {
									setSettingsOpen('')
									init(temp)
								}} />
							}
							{
								settingsOpen === 'RestoreWithUsernamePinScreen' && <RestoreWithUsernamePinScreen onRestore={temp => {
									init(temp)
								}} />
							}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Install Terminal 底部滑出：首次进入显示，Remind me later 后缓存不再显示 */}
			<InstallTerminalSheet
				open={showInstallSheet}
				onClose={() => setShowInstallSheet(false)}
			/>
		</div>
	)
}
