import { useState } from 'react'
import { KeyRound, Wallet, ShieldCheck } from 'lucide-react'
import { restoreWithUserPin } from '@/services/beamio'
import MerchantOS from '@/pages/Vouchers/example/biz'


const BizHome = () => {
	const [merchantTag, setMerchantTag] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [loginError, setLoginError] = useState('')
	const [isLoggedIn, setIsLoggedIn] = useState(false)

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setLoginError('')
		setIsLoading(true)
		try {
			const username = merchantTag.startsWith('@') ? merchantTag.slice(1) : merchantTag
			const ok = await restoreWithUserPin(username, password, true)
			if (ok === true) {
				setIsLoggedIn(true)
			} else {
				setLoginError('Invalid Beamio Tag or Recovery Password, please try again')
			}
		} catch {
			setLoginError('Login failed, please try again later')
		} finally {
			setIsLoading(false)
		}
	}

	if (isLoggedIn) {
		return <MerchantOS />
	}

	return (
		<div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 selection:bg-[#1562f0]/20">
			<div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-100 p-10 overflow-hidden relative">
				<div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
				<div className="relative z-10 flex flex-col items-center">
					<div
						className="
							w-[70px] h-[70px] rounded-[20px] mb-6
							bg-white
							ring-1 ring-slate-200/70
							shadow-[0_14px_28px_rgba(15,23,42,0.10)]
							flex items-center justify-center
						"
					>
						<span
							className="text-[48px] font-extrabold italic leading-none"
							style={{ color: '#1652f0' }}
						>
							B
						</span>
					</div>
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
									className="w-full pl-9 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900"
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
									className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] tracking-widest text-slate-900"
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
							className="w-full bg-black text-white py-4 rounded-[20px] font-semibold text-[16px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-6 flex justify-center items-center gap-2 disabled:opacity-60 disabled:hover:translate-y-0"
						>
							{isLoading ? (
								<>
									<span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
									Unlocking...
								</>
							) : (
								<>
									<Wallet size={18} /> Unlock Wallet
								</>
							)}
						</button>
					</form>

					<div className="mt-8 flex items-center gap-2 text-[11px] font-bold text-slate-400">
						<ShieldCheck size={14} className="text-emerald-500" />
						<span>Local EOA Derivation • Zero-Knowledge Architecture</span>
					</div>
				</div>
			</div>
		</div>
	)
}

export default BizHome
