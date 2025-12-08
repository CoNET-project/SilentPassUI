import React, {useEffect, useState} from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {getETHFaucet, onWalletEvent} from '@/services/beamio'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import styles from '@/components/Home/home.module.scss'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { createOrGetWallet, storeSystemData, checkStorage} from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import CreateUsernamePinScreen from './CreateUsernamePinScreen'
import RecoveryQRScreen from './RecoveryQRScreen'
import RestoreEntryScreen from './RestoreEntryScreen'
import RestoreWithQRScreen from './RestoreWithQRScreen'
import RestoreWithUsernamePinScreen from './RestoreWithUsernamePinScreen'
// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
}

export default function BeamioOnboardingModal({home}: Props) {
	const { setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag } = useDaemonContext()
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
			return setIsInitialEntry(true)
		}

		temp = temp||isAcc
	
		const profiles = temp?.profiles
		

		
		if (!temp || !profiles ) {
			return setIsInitialEntry(true)
		}

		setProfiles(profiles)

		const bo: beamio = temp?.beamio || {
			accountName: '',
			image: '',
			darkTheme: false,
			initialLoading: true,
			isUSDCFaucet: false,
			isETHFaucet: false,
			firstName: '',
			lastName: ''
		}

		
		bo.initialLoading = true
		
		if (!bo.isETHFaucet) {
			const newUser = await getETHFaucet(profiles[0].keyID)
			if (newUser) {
				bo.isETHFaucet = true
			}
		}
	
		setDarkModle(bo.darkTheme)
		setBeamio (bo)
		temp.beamio = bo
		setCoNET_Data(temp)
		await storeSystemData()
		SetLoading(false)
		setIsInitialEntry(false)
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
		<div className="flex flex-col flex-1 text-slate-900 text-[13px]">
			{/* 顶部小标题 */}
			<div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
				BEAMIO · USDC ON BASE
			</div>

			{/* 主标题 */}
			<h1 className="mt-2 text-[26px] font-semibold text-slate-900">
				Welcome to Beamio
			</h1>

			{/* 副标题 */}
			<p className="mt-1 text-[14px] text-slate-500 leading-snug">
			Create a gasless USDC account or restore an existing one.
			</p>

			{/* What you get 卡片 */}
			<div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
			<div className="text-[13px] font-semibold text-slate-900 mb-2">
				What you get
			</div>
			<ul className="list-disc pl-5 space-y-1.5 text-[13px] text-slate-700">
				<li>Self-custodial USDC wallet on Base (no email login).</li>
				<li>Gasless payments powered by Beamio infrastructure.</li>
				<li>
					@username + PIN with a Recovery QR instead of a seed phrase.
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
				Set up new Beamio account
			</AppButton>
			<p className="mt-2 text-[11px] text-slate-500 leading-snug">
				Recommended if this is your first time using Beamio.
			</p>
			</div>

			{/* 分割线 */}
			<hr className="mt-6 mb-4 border-slate-200" />

			{/* 已有账号区域 */}
			<div>
			<div className="text-[13px] font-semibold text-slate-900">
				Already use Beamio?
			</div>
			<p className="mt-1 text-[13px] text-slate-500 leading-snug">
				If you've used Beamio before and already created an account, <br />you can
				restore it with your Recovery QR or recovery code S.
			</p>

			<div className="mt-4">
				<AppButton
					fullWidth
					variant="secondary"
					className="rounded-[999px] py-3 text-[15px] font-semibold"
					
					onClick={() => setSettingsOpen('RestoreEntryScreen')}
				>
					I already have a Beamio account
				</AppButton>
			</div>

			<p className="mt-2 text-[11px] text-slate-500 leading-snug">
				This will take you to <span className="font-medium">Restore your Beamio account</span><br />
				(scan Recovery QR or enter recovery code S).
			</p>
			</div>
		</div>
	)

	
	return (
		<div className="">
			<div className="w-full max-w-lg p-6 md:p-8 mx-auto">
				{
					isInitialEntry ? <InitialEntryScreen /> : (<>
						{/* Logo + label */}
							<div className="flex items-center gap-3 mb-6">
							<div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
								B
							</div>
							<div>
								<div className="text-[11px] font-semibold tracking-[0.18em] text-blue-600 uppercase">
								Wallet created
								</div>
								<div className="text-sm text-slate-500">Beamio · Zero-Gas USDC on Base</div>
							</div>
							</div>

							{/* Title + subtitle */}
							<h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
							Your Beamio wallet is ready
							</h1>
							<p className="text-sm md:text-base text-slate-600 mb-4 md:mb-5 leading-relaxed">
							We&apos;ve created a self-custodial USDC wallet for you on Base. Only you can control this
							wallet – Beamio can&apos;t move your funds.
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
							<div className="space-y-2 mb-6 text-xs md:text-sm text-slate-600">
							<div className="flex items-start gap-2">
								<span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400 text-[11px] font-semibold text-emerald-600">
								✓
								</span>
								<p>
								Built on <span className="font-medium">Base</span> for low-cost, gasless USDC payments.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500">
								ⓘ
								</span>
								<p>
								On this device, your wallet is stored locally inside this Beamio app. Clearing app
								data or using a different environment may create a new wallet.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 text-[11px] font-semibold text-amber-600">
								!
								</span>
								<p>
									On mobile, always open Beamio from the <span className="font-medium">Home Screen / installed app icon</span>
									for the most stable experience.
								</p>
							</div>
							</div>

							{/* Primary action */}
							<AppButton
								loading={loading}
								fullWidth
								onClick={() => {
									home()
								}}
							>
								Start using Beamio
							</AppButton>
							

							{/* Secondary note */}
							<p className="text-[11px] md:text-xs text-center text-slate-400">
								You can view and manage your wallet details later in Settings.
							</p>
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
