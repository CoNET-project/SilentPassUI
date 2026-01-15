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
		<div className="
			/* 👇 安全区补偿 */
			pt-[env(safe-area-inset-top)]
			pb-[env(safe-area-inset-bottom)]
			pl-[env(safe-area-inset-left)]
			pr-[env(safe-area-inset-right)]
			w-full h-screen flex
		">
			<div className="overflow-y-auto p-6 md:p-8 mx-auto max-w-lg flex-1  ">
				<div className="flex flex-col flex-1 
				text-slate-900 text-[13px] 
				min-h-0
				pb-[calc(80px+env(safe-area-inset-bottom))]
				">
					{/* 顶部小标题 */}
					{/* <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
						BEAMIO · USDC ON BASE
					</div> */}

					{/* 主标题 */}
					<h1 className="mt-2 text-[26px] font-semibold text-slate-900">
						Welcome to Beamio
					</h1>

					{/* 副标题 */}
					<p className="mt-1 text-[14px] text-slate-500 leading-snug">
						Create a wallet — or restore one.
					</p>

					{/* 顶部小标题 */}
					<div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
						BEAMIO · USDC ON BASE
					</div>

					{/* What you get 卡片 */}
					<div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
						<div className="text-[13px] font-semibold text-slate-900 mb-2">
							What you’ll get
						</div>
					<ul className="list-disc pl-5 space-y-1.5 text-[13px] text-slate-700">
						<li>A self-custodial USDC wallet on Base — you control your funds.</li>
						<li>Gas sponsored for Beamio transfers.</li>
						<li>
							Two restore methods: @BeamioTag + Password, or Recovery QR/code.
						</li>
					</ul>
					</div>

					{/* 新建账号按钮 + 推荐文案 */}
					<div className="mt-6">
						<AppButton
							fullWidth
							className="rounded-[999px] py-3 text-[15px] font-semibold"
							onClick={() => setSettingsOpen('CreateUsernamePinScreen')}
						>
							Create wallet
						</AppButton>
					
					</div>

					{/* 分割线 */}
					<hr className="mt-6 mb-4 border-slate-200" />

					{/* 已有账号区域 */}
					<div>
						<div className="text-[13px] font-semibold text-slate-900">
							Already have a wallet?
						</div>
					<p className="mt-1 text-[13px] text-slate-500 leading-snug">
						Restore with your Recovery QR/code or @BeamioTag + Password.
					</p>

					<div className="mt-4">
						<AppButton
							fullWidth
							variant="secondary"
							className="rounded-[999px] py-3 text-[15px] font-semibold"
							
							onClick={() => setSettingsOpen('RestoreEntryScreen')}
						>
							Restore wallet
						</AppButton>
					</div>

					
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
