import React, {useEffect, useState} from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {onWalletEvent} from '@/services/beamio'
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
import RestoreEntryScreen from './RestoreEntryScreen'
import RestoreWithQRScreen from './RestoreWithQRScreen'
import RestoreWithUsernamePinScreen from './RestoreWithUsernamePinScreen'
import { userInfo } from "os";
// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
}

export default function BeamioOnboardingModal({home}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag, isInitialLoading, setIsInitialLoading } = useDaemonContext()
	const [addressPreview, SETaddressPreview] = useState('')
	const [loading, SetLoading] = useState(true)
	const navigate = useNavigate()

	const [settingsOpen, setSettingsOpen] = useState<''|'CreateUsernamePinScreen'|'RecoveryQRScreen'|'RestoreEntryScreen'|'RestoreWithQRScreen'|'RestoreWithUsernamePinScreen'>('')
	const [isInitialEntry, setIsInitialEntry] = useState(false)
	const [qrDataUrl, setQrDataUrl] = useState('')
	const [recoveryCode, setRecoveryCode]  = useState('')
	const [_temp, set_temp] = useState<any>()

	const init = async (temp?: encrypt_keys_object) => {

		const isAcc = await checkStorage()
		if (!isAcc) {
			setIsInitialLoading(true)
			return setIsInitialEntry(true)
		}

		temp = temp||isAcc
	
		const profiles = temp?.profiles
		

		
		if (!temp || !profiles ) {
			setIsInitialLoading(true)
			return setIsInitialEntry(true)
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

  	}

	let first = true

	useEffect(() => {
		if (first) {
			first = false
			init()
		}

	}, [])


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
            <br />
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
					isInitialEntry ? <InitialEntryScreen /> : (<>
						{/* Logo + label */}
						<div className="
							w-full max-w-lg p-6 md:p-8 mx-auto
						
						">
							<div className="flex items-center gap-3 mb-6 mt-8">
								<div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
									B
								</div>
								<div>
									
									<div className="text-sm text-slate-500">Beamio</div>
								</div>
							</div>

							{/* Title + subtitle */}
							<h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2 ">
								Wallet ready
							</h1>
							<p className="text-sm md:text-base text-slate-600 mb-4 md:mb-5 leading-relaxed">
								Self-custodial USDC on Base — you control your funds.
							</p>

							{addressPreview && (
								<div className="mb-5 md:mb-6">
									<div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase mb-1">
										Wallet address
									</div>
									<div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5">
									<span className="font-mono text-xs md:text-sm text-slate-800 truncate mr-3">
										{addressPreview}
									</span>
									<button
										type="button"
										className="text-[11px] md:text-xs font-medium text-blue-600 hover:text-blue-700"
									>
										Copy
									</button>
									</div>
								</div>
							)}

							{/* Bullets */}
							<div className="mb-6 space-y-4">
								{/* title */}
								<div className="text-[12px] tracking-[0.28em] font-semibold text-slate-400">
									WALLET READY
								</div>

								{/* bullets */}
								<div className="space-y-3 text-[16px] leading-relaxed text-slate-700">
									<div className="flex items-start gap-3">
									<span
										aria-hidden
										className="
										mt-[9px]
										h-3 w-3
										rounded-full
										bg-[#1652F0]
										flex-none
										"
									/>
									<p>Gas is sponsored for Beamio transfers.</p>
									</div>

									<div className="flex items-start gap-3">
									<span
										aria-hidden
										className="
										mt-[9px]
										h-3 w-3
										rounded-full
										bg-[#1652F0]
										flex-none
										"
									/>
									<p>Restore anytime with @BeamioTag + Password or Recovery QR/code.</p>
									</div>
									<div className="flex items-start gap-3">
									<span
										aria-hidden
										className="
										mt-[9px]
										h-3 w-3
										rounded-full
										bg-[#1652F0]
										flex-none
										"
									/>
									<p>Beamio doesn't store your password, recovery code, or private key.</p>
									</div>
								</div>
								</div>

							{/* Primary action */}
							<AppButton
								loading={loading}
								fullWidth
								onClick={() => {
									setIsInitialEntry(false)
									setIsInitialLoading(false)
									home()
								}}
							>
								Go To Home
							</AppButton>
							

							{/* Secondary note */}
							<p className="text-[11px] md:text-xs text-center text-slate-400">
								Manage recovery rotation and exports later in Settings.
							</p>
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
						/>

					{/* 内容区域：放你的 BeamioAccountScreen */}
						<div className="flex-1 overflow-y-auto">
							
							{
								settingsOpen === 'CreateUsernamePinScreen' && <CreateUsernamePinScreen close={qr => {
									setQrDataUrl(qr.qrDataUrl)
									setRecoveryCode(qr.passcode)
									setSettingsOpen('RecoveryQRScreen')
									
									set_temp(qr.temp)
								}} />
							}

							{
								settingsOpen === 'RecoveryQRScreen' && <RecoveryQRScreen qrDataUrl={qrDataUrl} recoveryCode={recoveryCode} close={() => {
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
		</div>
	)
}
