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
import { createOrGetWallet, storeSystemData} from "@/services/beamio"
import {AppButton} from '@/components/button/AppButton'

// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
	
}

export default function BeamioOnboardingModal({home}: Props) {
	const { profiles, setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPayTag } = useDaemonContext()
	const [addressPreview, SETaddressPreview] = useState('')
	const [loading, SetLoading] = useState(true)
	const init = async () => {
		
		const profiles = await createOrGetWallet('', false, '', '')
		setProfiles(profiles)

		const temp = CoNET_Data
		if (!temp || !profiles ) {
			return
		}

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

  	}
	let first = true
	useEffect(() => {
		if (first) {
			first = false
			init()
		}

	}, [])

	const navigate = useNavigate()
	return (
			<div className="">
				<div className="w-full max-w-lg p-6 md:p-8 mx-auto">
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
				</div>
		</div>
	)
}
