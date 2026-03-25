import React, { useEffect, useState, useRef } from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
import { Zap, ChevronRight, Fingerprint, Gift, Check, Loader, Globe, ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle, X } from "lucide-react"
import { getAAAccount, getRedeemDetailsForDisplay, postCardRedeem, getMyAssets } from "@/services/BeamioCard"
import { initChat}from '@/services/chat'

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
import { getUserInfo, storeSystemData, checkStorage, restoreWithRedeem } from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import CreateUsernamePinScreen, { type CreateUsernamePinScreenRef } from './CreateUsernamePinScreen'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import RestoreWithQRScreen from './RestoreWithQRScreen'
import RestoreWithUsernamePinScreen from './RestoreWithUsernamePinScreen'
import WalletReadyScreen from './WalletReadyScreen'
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'


const APP_VERSION = (packageJson as { version?: string }).version ?? ''
/** `public/logo512.png` — respects `package.json` homepage / `PUBLIC_URL` */
const CASHTREES_LOGO_PWA = `${process.env.PUBLIC_URL ?? ''}/logo512.png`
const ISSUED_NFT_START_ID = 100_000_000_000

/** 从 NFT tokenId 推导卡号显示：issued NFT 用序号，tier NFT 用 tokenId */
function formatMemberNo(tokenId: string | number): string {
	const n = Number(tokenId)
	if (n >= ISSUED_NFT_START_ID) {
		return `M-${String(n - ISSUED_NFT_START_ID + 1).padStart(6, '0')}`
	}
	return `M-${String(n).padStart(6, '0')}`
}

// Simple mobile-style onboarding modal for CashTrees (SilentPass UI shell)
// TailwindCSS-based layout

type Props = {
	home: () => void
	onInitComplete?: () => void
}

const TOP_OFFSET = "calc(env(safe-area-inset-top) + 4rem)"

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
							<span className="text-[13px] font-bold text-orange-800 block">Invalid Redeem Code</span>
							<span className="text-[12px] text-orange-700 leading-snug">
								{redeemDetails?.status === 'not_found' ? 'This code has already been used or does not exist.' : redeemDetails?.status === 'cancelled' ? 'This redeem has been cancelled.' : 'Unable to verify this redeem code. Please check the link and try again.'}
							</span>
						</div>
					</div>
				) : (
				<div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/40 px-4 py-2 rounded-full shadow-sm mb-8">
					<div className="w-4 h-4 rounded-full bg-[#1652f0] flex items-center justify-center"><ShieldCheck size={10} className="text-white" /></div>
					<span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Verified Asset • Ready to Claim</span>
				</div>
				)}
				<div className="w-full max-w-[340px] perspective-1000 mb-10">
					<div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl">
						<img src={ccsabackphoto} alt="CCSA Card" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
						<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_38%,rgba(0,0,0,0.18)_100%)]" />
						<div className="relative z-10 p-5 h-full flex flex-col justify-between">
							<div className="flex justify-between items-start">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg, #ffd65a 0%, #d19a00 100%)' }}><Globe className="h-5 w-5 text-white" /></div>
									<div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] drop-shadow-sm font-serif">CCSA</div><div className="text-[18px] font-black tracking-wide text-[#fff2c6] -mt-0.5 font-serif">CARD</div></div>
								</div>
								<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1 text-white"><Globe size={10} className="text-white" /> Membership</div>
							</div>
							<div><p className="text-[10px] font-bold opacity-80 uppercase mb-0.5">Balance</p><div className="flex items-baseline gap-1"><span className="text-3xl font-medium tracking-tighter text-[#fff2c6]">{isValid && redeemDetails ? (() => { const pts = Number(redeemDetails.pointsHuman); const ptsPer1 = Number(redeemDetails.ptsPer1Currency); const amt = ptsPer1 ? pts / ptsPer1 : pts; return formatAmount(amt, redeemDetails.currency as any, amt > 0 && amt < 0.01 ? 4 : undefined); })() : '100.00'}</span><span className="text-sm font-semibold opacity-90 text-[#fff2c6]">{isValid && redeemDetails ? (redeemDetails.currency as string) : 'CAD'}</span></div></div>
						</div>
					</div>
					<div className="w-[90%] h-4 mx-auto bg-blue-900/20 blur-xl rounded-full mt-4" />
				</div>
				<div className="mt-4 text-center space-y-3 max-w-xs mx-auto">
					<h1 className="text-3xl font-bold text-slate-900 tracking-tight">Activate Your Card.</h1>
					<p className="text-slate-500 text-[15px] font-medium leading-relaxed">Create a secure CashTrees wallet to claim this membership. No app download required yet.</p>
				</div>
			</div>
			<div className="p-6 pb-10 mb-40 bg-gradient-to-t from-[#F5F5F7] to-transparent z-20">
				<button
					onClick={onActivate}
					disabled={isInvalid}
					className={`group w-full h-16 rounded-full font-bold text-[17px] transition-all flex items-center justify-between px-2 pl-6 ${isValid ? 'bg-[#1652f0] text-white shadow-lg shadow-blue-500/30 active:scale-95' : isInvalid ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#1652f0] text-white shadow-lg shadow-blue-500/30 animate-pulse'}`}
				>
					<span>Activate Now</span>
					<div className={`w-12 h-12 rounded-full flex items-center justify-center ${isValid ? 'bg-white text-[#1652f0] group-hover:scale-105' : isInvalid ? 'bg-slate-100' : 'bg-white/80'}`}><ArrowRight size={24} strokeWidth={3} /></div>
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

export default function BeamioOnboardingModal({home, onInitComplete}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, 
		setAllNodes, setGossip, gossip,
		setIsInitialLoading, myAddress, setMyAddress, usdcbalance, setShowFooter, setCharts } = useDaemonContext()
	const [walletAddr, setWalletAddr] = useState('')
	const [usdcBal, setUsdcBal] = useState('0')
	const [eoaAddress, setEoaAddress] = useState('')
	const [loading, SetLoading] = useState(true)
	const navigate = useNavigate()

	const [settingsOpen, setSettingsOpen] = useState<''|'CreateUsernamePinScreen'|'RecoveryQRScreen'|'WalletReadyScreen'|'RestoreEntryScreen'|'RestoreWithQRScreen'|'RestoreWithUsernamePinScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(false)
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
	const createUsernameRef = useRef<CreateUsernamePinScreenRef>(null)
	const homeCalledRef = useRef(false)
	const [redeemActivating, setRedeemActivating] = useState(false)
	const [redeemPostCreateInProgress, setRedeemPostCreateInProgress] = useState(false)

	// 隐藏全局 footer：redeem 进行中 Loading 或 Card Active 成功页
	useEffect(() => {
		const shouldHide = redeemActivating || redeeming || (redeemFromUrl && !redeeming && redeemResult?.success)
		setShowFooter?.(!shouldHide)
		return () => setShowFooter?.(true)
	}, [redeemActivating, redeeming, redeemFromUrl, redeemResult?.success, setShowFooter])

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

	let first = true

	// 仅适用于首次启动（本地存储无 beamio 信息）时的启动 URL 参数，不适用于 scan QR workflow
	useEffect(() => {
		if (!first) return
		first = false
		const run = async () => {
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
					setSettingsOpen('RestoreWithQRScreen')
					setHasCheckedUrl(true)
					onInitComplete?.()
					return
				}
				// beamioTag 存在但无 MasterKey：直接进入 RestoreEntryScreen（恢复 wallet 入口）
				setIsInitialEntry(true)
				setSettingsOpen("RestoreEntryScreen")
				setHasCheckedUrl(true)
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
		const isWalletReady = settingsOpen === 'WalletReadyScreen'
		if ((isCardActive || isWalletReady) && beamioTag && recoveryCode) {
			const t = setTimeout(() => applyPwaUrlParams(beamioTag, recoveryCode), isCardActive ? 300 : 400)
			return () => clearTimeout(t)
		}
		if (isWalletReady) updateManifestStartUrl(window.location.href)
	}, [settingsOpen, redeemFromUrl, redeeming, redeemResult?.success, beamioTag, recoveryCode])

	// loading ready 后：无 redeem URL 则直接进入 home（防重复调用）；WalletReadyScreen 阶段不触发
	useEffect(() => {
		if (isInitialEntry || !hasCheckedUrl || redeemFromUrl !== null || loading) return
		if (settingsOpen === 'WalletReadyScreen') return
		if (homeCalledRef.current) return
		homeCalledRef.current = true
		setIsInitialEntry(false)
		setIsInitialLoading(false)
		home()
	}, [isInitialEntry, hasCheckedUrl, redeemFromUrl, loading, settingsOpen, home])

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
						setRedeemResult(result.success ? { success: true, tx: result.tx } : { success: false, error: result.error ?? 'Redeem failed' })
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
				setRedeemResult(result.success ? { success: true, tx: result.tx } : { success: false, error: result.error ?? 'Redeem failed' })
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

	const InitialEntryScreen = () => (
  <div
    className="
      pt-[env(safe-area-inset-top)]
      pb-[env(safe-area-inset-bottom)]
      pl-[env(safe-area-inset-left)]
      pr-[env(safe-area-inset-right)]
      w-full h-screen bg-[#F8F9FA] relative
    "
  >
    {APP_VERSION && <div className="absolute top-[env(safe-area-inset-top)] right-6 md:right-8 z-10 text-[11px] text-slate-400/50">v{APP_VERSION}</div>}
    <div className="h-full max-w-lg mx-auto px-6 md:px-8">
      <div className="h-full flex flex-col items-center">
        <div className="flex-1 min-h-4" />

        <div className="flex flex-col items-center text-center">
          <img
            src={CASHTREES_LOGO_PWA}
            alt="CashTrees"
            className="w-[172px] h-[172px] object-contain select-none"
            draggable={false}
          />

          <div className="mt-2 text-[40px] md:text-[44px] font-extrabold tracking-[-0.02em] text-[#0F172A]">
            CashTrees
          </div>

          <p className="mt-1.5 max-w-[280px] text-[15px] md:text-base font-normal leading-snug text-slate-500">
            Local Spending, Simplified.
          </p>
        </div>

        {isStandalone && (
          <div className="w-full mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <p className="text-[15px] font-medium text-amber-800 dark:text-amber-200 leading-snug">
              Opened from home screen? Wallet data from Safari doesn&apos;t transfer. Use <strong>Restore Wallet</strong> with your recovery code below.
            </p>
          </div>
        )}

        <div className="w-full mt-6 space-y-4">
          <AppButton
            fullWidth
            className="
              rounded-[999px] !h-auto min-h-[56px] py-5 text-[17px] font-bold
              !bg-[#96EB3C] hover:!bg-[#8ADC32] active:!bg-[#7ECF28]
              !text-[#0F172A]
              !shadow-[0_14px_32px_rgba(150,235,60,0.42)]
              active:!shadow-[0_10px_24px_rgba(150,235,60,0.32)]
              focus-visible:!ring-2 focus-visible:!ring-[#96EB3C]/50
            "
            onClick={() => setSettingsOpen("CreateUsernamePinScreen")}
          >
            Create Wallet
          </AppButton>

          <AppButton
            fullWidth
            variant="secondary"
            className="
              rounded-[999px] !h-auto min-h-[56px] py-5 text-[17px] font-bold
              !bg-white hover:!bg-slate-50
              border border-slate-200/90
              !text-[#0F172A]
              !shadow-[0_10px_26px_rgba(15,23,42,0.07)]
              active:!shadow-[0_7px_18px_rgba(15,23,42,0.05)]
            "
            onClick={() => setSettingsOpen("RestoreEntryScreen")}
          >
            Restore Wallet
          </AppButton>
        </div>

        <div className="flex-1 min-h-4" />

        <div
          className="
            sticky bottom-0 w-full
            pt-4 pb-[calc(14px+env(safe-area-inset-bottom))]
            text-[13px] font-normal text-slate-400 text-center
            bg-[#F8F9FA]
          "
        >
          Card Ready. Non-custodial.
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
					isInitialEntry ? (redeemFromUrl ? <RedeemSplashStep onActivate={() => setSettingsOpen("CreateUsernamePinScreen")} redeemDetails={redeemDetails} redeemDetailsLoading={redeemDetailsLoading} /> : <InitialEntryScreen />) : (hasCheckedUrl && !redeemFromUrl) ? null : (
					<>
						{/* Card Active 成功画面：redeem 完成后显示 */}
						{redeemFromUrl && !redeeming && redeemResult?.success ? (
							<div className="w-full max-w-lg mx-auto px-6 md:px-8 min-h-full flex flex-col pt-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
								{/* Success Header */}
								<div className="flex flex-col items-center mb-8">
									<div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-6">
										<Check size={32} className="text-white" strokeWidth={4} />
									</div>
									<h1 className="text-[32px] font-bold text-slate-900 tracking-tight text-center leading-tight">Card Active!</h1>
									<p className="text-slate-500 font-medium mt-2">Redemption complete. Funds available.</p>
								</div>

								{/* CCSA 卡片 + READY badge */}
								<div className="w-full max-w-[340px] mx-auto mb-10 relative">
									<div className="rounded-[24px] overflow-hidden shadow-2xl relative" style={{ aspectRatio: '1.58 / 1' }}>
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
												<div className="flex flex-col items-end gap-1.5">
													<div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs text-white font-semibold flex items-center gap-1">
														<Globe size={10} className="text-white" /> Membership
													</div>
													<div className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
														<Zap size={10} fill="currentColor" /> READY
													</div>
												</div>
											</div>
											<div className="flex items-end justify-between gap-2 min-w-0">
												<div>
													<p className="text-[10px] font-bold opacity-80 uppercase mb-0.5 text-[#fff2c6]">Balance</p>
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
										className="h-16 rounded-full text-base font-bold uppercase tracking-wide bg-[#1652f0] hover:bg-[#1345ca] text-white shadow-[0_12px_30px_rgba(22,82,240,0.3)]"
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
									<img
										src={CASHTREES_LOGO_PWA}
										alt=""
										className="h-[72px] w-[72px] object-contain shrink-0 select-none"
										draggable={false}
									/>
									<span className="text-base font-semibold text-slate-900 dark:text-slate-100">
										CashTrees Wallet
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

							{/* CCSA 卡片 */}
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

							{/* GO TO HOME Button */}
							{!redeeming && (
								<div className="mt-auto pb-4">
									<AppButton
										loading={loading}
										fullWidth
										onClick={() => {
											window.location.reload()
										}}
										className="h-[56px] rounded-2xl text-base font-bold uppercase tracking-wide bg-[#1652f0] hover:bg-[#1345ca] text-white shadow-[0_12px_30px_rgba(22,82,240,0.3)]"
									>
										Go To Home
									</AppButton>
								</div>
							)}
						</div>
						)}
					</>)
				}
				
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
									if (settingsOpen === 'WalletReadyScreen') setSettingsOpen('RecoveryQRScreen')
									else if (settingsOpen === 'RecoveryQRScreen') setSettingsOpen('CreateUsernamePinScreen')
									else if (settingsOpen === 'RestoreWithQRScreen' || settingsOpen === 'RestoreWithUsernamePinScreen') setSettingsOpen('RestoreEntryScreen')
									else if (settingsOpen === 'CreateUsernamePinScreen') {
										const handled = createUsernameRef.current?.goBack()
										if (!handled) setSettingsOpen('')
									} else setSettingsOpen('')
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
								settingsOpen === 'CreateUsernamePinScreen' && <CreateUsernamePinScreen ref={createUsernameRef} isRedeemFlow={!!redeemFromUrl} close={qr => {
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
										setSettingsOpen('WalletReadyScreen')
									}} />
							}
							{
								settingsOpen === 'WalletReadyScreen' && <WalletReadyScreen
									usdcBalance={formatWithThousands(usdcBal || '0')}
									onGoToHome={() => home()}
									address={eoaAddress || undefined}
									balanceFiat={formatAmount(parseFloat(usdcBal || '0') || 0, 'CAD')}
									beamioTag={beamioTag || undefined}
								/>
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
									onRestore={temp => {
										setSettingsOpen('')
										setRestoreFromUrlMasterKey('')
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

		</div>
	)
}
