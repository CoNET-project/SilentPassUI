import { useState } from 'react'
import { KeyRound, Wallet, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { APP_VERSION } from '@/version'
import { ethers } from 'ethers'
import { restoreWithUserPin, getUserInfo, storeSystemData } from '@/services/beamio'
import { setCoNET_Data } from '@/utils/globals'
import { initChat } from '@/services/chat'
import { fetchTrustedCanonicalAaFromRpc } from '@/services/BeamioCard'
import { baseEndpoint } from '@/utils/constants'
import { useDaemonContext } from '@/providers/DaemonProvider'
import MerchantOS from '@/pages/Vouchers/example/biz'
import NewMerchantOS from '@/pages/Vouchers/example/newBiz'

/**
 * Primary CTA lime — matches `cashTreeHome` / `biz.tsx` Merchant OS.
 * Hover / active / on-color: `#8ADC32`, `#7ECF28`, `#0F172A`.
 */
const BIZ_UI_PRIMARY = '#96EB3C'

const bizUiPrimarySolid =
	'bg-[#96EB3C] text-[#0F172A] hover:bg-[#8ADC32] active:bg-[#7ECF28] shadow-[0_14px_32px_rgba(150,235,60,0.42)] active:shadow-[0_10px_24px_rgba(150,235,60,0.32)]'

const inputFocusPrimary =
	'focus:outline-none focus:ring-2 focus:ring-[#96EB3C]/30 focus:border-[#96EB3C]'

/** `public/logo512.png` (respects `homepage` e.g. `/biz`) */
const BIZ_PUBLIC_LOGO512 = `${process.env.PUBLIC_URL ?? ''}/logo512.png`

/** Assemble encrypt_keys_object after login (mirror App.tsx init): load beamio, initChat, persist */
const assembleEncryptKeysObject = async (
	temp: encrypt_keys_object,
	setProfiles: (val: profile[]) => void,
	setAllNodes: (val: nodeInfo[]) => void,
	setGossip: (val: boolean) => void,
	gossip: boolean,
	setBeamio: (val: beamio) => void,
	setCharts: React.Dispatch<React.SetStateAction<string[]>>,
	setMyAddress: (val: string) => void,
	onProgress?: (step: number) => void
) => {
	const profiles = temp?.profiles
	if (!temp || !profiles?.length) return

	const loadUserInfo = (): Promise<beamio> =>
		new Promise((resolve) => {
			getUserInfo(profiles[0].keyID).then((userInfo) => {
				if (!userInfo) {
					setTimeout(() => resolve(loadUserInfo()), 1000)
				} else {
					resolve(userInfo)
				}
			})
		})

	const userInfo = await loadUserInfo()
	if (!userInfo) return

	const bo: beamio = userInfo
	bo.initialLoading = true
	temp.beamio = bo

	// Trusted RPC：与本地缓存比对，不一致则更新（含链上无 AA 时清除无 bytecode 的错误缓存）
	try {
		const eoa0 = profiles[0]?.keyID?.trim()
		if (eoa0 && ethers.isAddress(eoa0)) {
			const r = await fetchTrustedCanonicalAaFromRpc(eoa0)
			if (r.trusted) {
				let nextProfiles = profiles
				let changed = false
				if (r.aa) {
					const chainAa = ethers.getAddress(r.aa)
					const cached = profiles[0].aaAccount?.trim()
					if (
						!cached ||
						!ethers.isAddress(cached) ||
						ethers.getAddress(cached).toLowerCase() !== chainAa.toLowerCase()
					) {
						nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: chainAa } : p))
						changed = true
					}
				} else {
					const cached = profiles[0].aaAccount?.trim()
					if (cached && ethers.isAddress(cached)) {
						const code = await baseEndpoint.getCode(cached)
						if (!code || code === '0x' || code.length <= 2) {
							nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: undefined } : p))
							changed = true
						}
					}
				}
				if (changed) {
					temp.profiles = nextProfiles
					setProfiles(nextProfiles)
				}
			}
		}
	} catch {
		// Keep last trusted; RPC failure does not overwrite
	}

	setCoNET_Data(temp)
	setBeamio(bo)
	onProgress?.(2) // Securing done, starting sync

	await initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
		setCharts((prev) => [...prev, message])
	})

	await storeSystemData()
	const eoa = profiles[0]?.keyID?.trim()
	if (eoa && ethers.isAddress(eoa)) {
		setMyAddress(eoa)
	}
}

const LOGIN_STAGES = [
	'Deriving Local EOA via ZK-Proof',
	'Securing Vault Infrastructure',
	'Syncing Ledger State',
] as const

const BizHome = () => {
	const [merchantTag, setMerchantTag] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [loadingStep, setLoadingStep] = useState(0)
	const [loginError, setLoginError] = useState('')
	const [isLoggedIn, setIsLoggedIn] = useState(false)
	const [showNewBiz, setShowNewBiz] = useState(false)

	const {
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
	} = useDaemonContext()

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoginError('')
		setIsLoading(true)
		setLoadingStep(0)
		let willTransitionToHome = false
		try {
			const username = merchantTag.startsWith('@') ? merchantTag.slice(1) : merchantTag
			const result = await restoreWithUserPin(username, password, false)
			const temp = result && typeof result === 'object' && result.profiles ? result : null
			if (!temp) {
				setLoginError('Invalid Beamio Tag or Recovery Password, please try again')
				setLoadingStep(0)
				return
			}
			setLoadingStep(1)
			await assembleEncryptKeysObject(
				temp,
				setProfiles,
				setAllNodes,
				setGossip,
				gossip,
				setBeamio,
				setCharts,
				setMyAddress,
				setLoadingStep
			)
			setLoadingStep(3)
			willTransitionToHome = true
			setTimeout(() => {
				setIsLoggedIn(true)
				setIsLoading(false)
			}, 400)
		} catch {
			setLoginError('Login failed, please try again later')
			setLoadingStep(0)
		} finally {
			if (!willTransitionToHome) {
				setIsLoading(false)
			}
		}
	}

	if (showNewBiz) {
		return <NewMerchantOS />
	}
	if (isLoggedIn) {
		return <MerchantOS />
	}

	if (isLoading) {
		return (
			<div
				data-biz-ui-primary={BIZ_UI_PRIMARY}
				className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 selection:bg-[#96EB3C]/30"
			>
				<div className="w-full max-w-[420px] bg-white/80 backdrop-blur-3xl rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-12 flex flex-col items-center justify-center relative overflow-hidden">
					<div className="w-16 h-16 border-[3px] border-slate-100 border-t-[#96EB3C] rounded-full animate-spin mb-10" />
					<div className="space-y-5 w-full">
						{LOGIN_STAGES.map((text, idx) => (
							<div
								key={idx}
								className={`flex items-center gap-4 transition-all duration-700 ${loadingStep >= idx ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-0'}`}
							>
								<div
									className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-500 shrink-0 ${
										loadingStep > idx ? 'bg-[#96EB3C] text-[#0F172A]' : 'bg-slate-100 text-slate-300'
									}`}
								>
									{loadingStep > idx ? (
										<CheckCircle2 size={16} />
									) : loadingStep === idx ? (
										<span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#96EB3C] rounded-full animate-spin" />
									) : (
										<div className="w-2 h-2 rounded-full bg-slate-300" />
									)}
								</div>
								<span
									className={`text-[15px] ${loadingStep > idx ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'}`}
								>
									{text}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div
			data-biz-ui-primary={BIZ_UI_PRIMARY}
			className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 selection:bg-[#96EB3C]/30"
		>
			<div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-100 p-10 overflow-hidden relative">
				<div className="absolute top-0 right-0 w-64 h-64 bg-[#96EB3C]/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
				<div className="relative z-10 flex flex-col items-center">
					<img
						src={BIZ_PUBLIC_LOGO512}
						alt="Beamio"
						className="h-[140px] w-[140px] mb-6 object-contain"
					/>
					<h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Merchant OS</h1>
					<p className="text-[13px] font-medium text-slate-500 mb-8">Access your decentralized store wallet</p>

					<form onSubmit={handleLogin} className="w-full space-y-4">
						<div className="space-y-1.5">
							<label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Beamio Tag</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<span className="text-slate-400 font-bold">@</span>
								</div>
								<input
									type="text"
									value={merchantTag.replace('@', '')}
									onChange={(e) => setMerchantTag(e.target.value ? `@${e.target.value}` : '')}
									className={`w-full pl-9 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl ${inputFocusPrimary} transition-all font-semibold text-[15px] text-slate-900`}
									required
									disabled={isLoading}
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recovery Password</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
									<KeyRound size={16} className="text-slate-400" />
								</div>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••••••"
									className={`w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl ${inputFocusPrimary} transition-all font-medium text-[15px] tracking-widest text-slate-900`}
									required
									disabled={isLoading}
								/>
							</div>
						</div>

						{loginError && (
							<div className="text-[13px] font-medium text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-100">
								{loginError}
							</div>
						)}

						<button
							type="submit"
							disabled={isLoading}
							className={`w-full py-4 rounded-[20px] font-semibold text-[16px] transition-all mt-6 flex justify-center items-center gap-2 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-[#96EB3C] disabled:shadow-none ${bizUiPrimarySolid}`}
						>
							{isLoading ? (
								<>
									<span className="w-5 h-5 border-2 border-[#0F172A]/25 border-t-[#0F172A] rounded-full animate-spin shrink-0" />
									Unlocking...
								</>
							) : (
								<>
									<Wallet size={18} /> Unlock Wallet
								</>
							)}
						</button>
					</form>

					<div className="mt-8 flex flex-col items-center gap-1">
						<button
							type="button"
							onClick={() => setShowNewBiz(true)}
							className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
						>
							<ShieldCheck size={14} className="text-[#96EB3C]" />
							<span>Local EOA Derivation • Zero-Knowledge</span>
						</button>
						<span className="text-[10px] text-slate-400 font-medium">v{APP_VERSION}</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export default BizHome
