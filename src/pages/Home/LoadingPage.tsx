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
import ccsabackphoto from '../Vouchers/assets/ccsacard.avif'
import packageJson from '../../../package.json'


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

	const [settingsOpen, setSettingsOpen] = useState<''|'CreateUsernamePinScreen'|'RecoveryQRScreen'|'RestoreEntryScreen'|'RestoreWithQRScreen'|'RestoreWithUsernamePinScreen'>('')
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
	const createUsernameRef = useRef<CreateUsernamePinScreenRef>(null)
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
      pt-[env(safe-area-inset-top)]
      pb-[env(safe-area-inset-bottom)]
      pl-[env(safe-area-inset-left)]
      pr-[env(safe-area-inset-right)]
      w-full h-screen bg-white relative
    "
  >
    {APP_VERSION && <div className="absolute top-[env(safe-area-inset-top)] right-6 md:right-8 z-10 text-[11px] text-slate-500/30">v{APP_VERSION}</div>}
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
            The Commerce State Layer for USDC.
          </div>
        </div>

        {/* iOS PWA 提示：从 Safari 添加到主屏幕后，PWA 无法读取浏览器数据，需用恢复码还原 */}
        {isStandalone && (
          <div className="w-full mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <p className="text-[15px] font-medium text-amber-800 dark:text-amber-200 leading-snug">
              Opened from home screen? Wallet data from Safari doesn&apos;t transfer. Use <strong>Restore Wallet</strong> with your recovery code below.
            </p>
          </div>
        )}

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
									if (settingsOpen === 'RecoveryQRScreen') setSettingsOpen('CreateUsernamePinScreen')
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
