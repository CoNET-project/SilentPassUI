import React, { useState, useEffect } from "react";
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { X, Copy, Check, XCircle, DollarSign } from "lucide-react"
import {useAutoFocus} from '@/components/input/useAutoFocus'
import {BuyWithCoinbaseButton} from './BuyWithCoinbaseButton'

const remote = 'https://beamio.app'

type RampMode = "onramp" | "offramp";
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CoinbaseRamps: React.FC = () => {
	const [mode, setMode] = useState<RampMode>("onramp")
	const [step, setStep] = useState(0)
	const [amount, setAmount] = useState<string>("")
	const [loading, setLoading] = useState(false)
	const [url, setUrl] = useState('')
	const [error, setError] = useState('')
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, 
			profiles, payTag, setPayTag, usdcbalance, usdcToUSD, myAddress, 
			setMyAddress, setListenningProcess, listenningProcess, setUsdcbalance, setUsdcToUSD } = useDaemonContext()
	const resetFlow = (newMode: RampMode) => {
		setMode(newMode);
		setStep(0);
		setAmount("")
	}

	const onrampClick = async () => {
		if (!myAddress||url) return

		setLoading(true)
		const params = new URLSearchParams({address: myAddress, paymentAmount: '10'}).toString()

		try {
			const res = mode === 'onramp' ? await fetch(`${remote}/api/coinbase-token?${params}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			}) : await fetch(`${remote}/api/coinbase-token?${params}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			})
			
			if (!res.ok) {
				console.error('Failed to create onramp session', await res.text())
				return 
			}

			const { onrampUrl } = await res.json() as { onrampUrl: string }

			if (!onrampUrl) {
				console.error('No onrampUrl in response')
				return 
			}

			// ⭐ 直接打开 Coinbase 返回的安全 URL（已包含 sessionToken）
			setUrl( onrampUrl )
			
		} catch (e) {
			console.error('open coinbase onramp error', e)
			return 
		}
	}

	useEffect(() =>{
		onrampClick()
	}, [])

	const title =
		mode === "onramp" ? "Add funds via Coinbase" : "Cash out via Coinbase";

	const description =
		mode === "onramp"
		? "Top up your Beamio wallet with USDC on Base. Fiat payments and KYC are handled by Coinbase."
		: "Convert your USDC on Base to fiat via Coinbase. Beamio never touches your bank details.";

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="sticky top-0 z-10">
				<div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
				<button
					type="button"
					className="p-2 -ml-2 rounded-full hover:bg-slate-100"
					onClick={() => {
					// TODO: integrate with your router: history.back()
					}}
				>
				
				</button>
				<h1 className="text-sm font-semibold text-slate-900">{title}</h1>
				<div className="w-6" />
				</div>
			</header>

			<main className="mx-auto max-w-md px-4 py-4 pb-8">
				{/* Mode toggle */}
				<div className="mb-4 flex rounded-full bg-slate-100 p-1 text-xs font-medium">
					<button
						type="button"
						onClick={() => resetFlow("onramp")}
						className={`flex-1 py-2 rounded-full ${
						mode === "onramp"
							? "bg-white shadow-sm text-slate-900"
							: "text-slate-500"
						}`}
					>
						Add funds
					</button>
					<button
						type="button"
						onClick={() => resetFlow("offramp")}
						className={`flex-1 py-2 rounded-full ${
						mode === "offramp"
							? "bg-white shadow-sm text-slate-900"
							: "text-slate-500"
						}`}
					>
						Cash out
					</button>
					{
						error && (
							<p className="text-[11px] text-rose-500">
								An error occurred. Please try again later.
							</p>
						)
					}
				</div>

				{/* Description */}
				<p className="text-xs text-slate-500 mb-4 leading-relaxed">{description}</p>

				{/* Step indicator */}
				<div className="flex items-center gap-2 mb-4 text-[11px] text-slate-500">
				{[0, 1, 2].map((s) => (
					<div key={s} className="flex items-center gap-1">
					<div
						className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] ${
						step >= s
							? "bg-slate-900 text-white"
							: "bg-slate-200 text-slate-500"
						}`}
					>
						{s + 1}
					</div>
					{s < 2 && <div className="w-6 h-px bg-slate-200 last:hidden" />}
					</div>
				))}
				</div>

				{/* Step content */}
				<div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
				{step === 0 && <StepIntro mode={mode} url={url} onNext={ async () => {
					const url = await onrampClick()
				
					
				}} />}

				{step === 1 && (
					<StepAmount
						mode={mode}
						amount={amount}
						setAmount={setAmount}
						onBack={() => setStep(0)}
						onNext={() => {
							onrampClick()
						}}
					/>
				)}

				{step === 2 && (
					<StepResult
						mode={mode}
						onBackHome={() => {
							console.log(`kkkkkk`)
							// TODO: route to Home
						}}
						onRestart={() => {
							console.log(`kkkkkk`)
							resetFlow(mode)
						}}
					/>
				)}
				</div>

				{/* Coinbase branding note */}
				<p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
					Fiat on/off ramp is provided by Coinbase. Beamio remains a non-custodial USDC wallet on Base; we never hold your fiat or bank details.
				</p>
			</main>
		</div>
	)
}



const StepIntro: React.FC<{ mode: RampMode; onNext: () => void, url: string }> = ({
		mode,
		onNext,
		url
	}) => {
	const isOnramp = mode === "onramp";

	return (
		<>
		<div className="space-y-2">
			<h2 className="text-sm font-semibold text-slate-900">
			{isOnramp ? "How it works" : "How cash out works"}
			</h2>
			<ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
			{isOnramp ? (
				<>
				<li>You choose how much to add.</li>
				<li>We send you to Coinbase to pay with card or bank.</li>
				<li>
					USDC is deposited into your Beamio wallet on Base once complete.
				</li>
				</>
			) : (
				<>
				<li>You choose how much USDC to cash out.</li>
				<li>We route you to Coinbase to pick your bank account.</li>
				<li>Coinbase handles fiat payout to your bank.</li>
				</>
			)}
			</ol>
		</div>

		<button
			type="button"
			onClick={() => {
				const a = document.createElement('a')
				a.href = url
				a.target = '_blank'
				a.rel = 'noopener noreferrer'
				document.body.appendChild(a)
				a.click()
				a.remove()
			}}
			className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
		>
			Continue
		</button>
		</>
	)
	}

const StepAmount: React.FC<{
		mode: RampMode;
		amount: string;
		setAmount: (v: string) => void;
		onBack: () => void;
		onNext: () => void;
	}> = ({ mode, amount, setAmount, onBack, onNext }) => {
		const isOnramp = mode === "onramp";
				const { profiles, usdcbalance,
			} = useDaemonContext()
		const [loading, setLoading] = useState<boolean>(false)
		const [showPayConfirm, setShowPayConfirm] = useState<boolean>(false)
		const [sendError, setSendError] = useState<string>('')
		
		const checkBalance = () => {
			if (usdcbalance - Number(amount) < 0) {
				setSendError('Insufficient USDC balance')
				return false
			}
			setSendError('')
			return true
		}
		const [showChatSendAmount, setShowChatSendAmount] = useState<boolean>(false)
		const amountInputRef = useAutoFocus<HTMLInputElement>(showChatSendAmount)

		const openAmount = () => {
			setShowChatSendAmount(true)

			// iOS：尽量把 focus 放在同一次点击的调用栈附近
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
				amountInputRef.current?.focus({ preventScroll: true })
				})
			})
		}

		

		return (
			<>
										<div className="mb-4">
										<div className="text-[12px] uppercase tracking-wide text-slate-400 mb-1 text-center">
											{isOnramp ? "Amount to add" : "Amount to cash out"}
										</div>

										<div className="relative">
											{/* 左侧：USDC icon + MAX（不占位） */}
											<div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
											{/* Token icon */}
											{
												!isOnramp && (
													<div className="relative pointer-events-none">
														<img
															src={usdcIcon}
															alt="USDC"
															className="w-6 h-6 rounded-full"
														/>
														<img
															src={baseIcon}
															alt="Base"
															className="
																w-3 h-3
																absolute bottom-0 right-0
																rounded-full
																border border-white dark:border-slate-900
															"
														/>
													</div>
												)
											}

											{
												isOnramp && (
													<>
														US
														<div
															className="
																w-6 h-6
																flex items-center justify-center
																rounded-full
																bg-sky-100/80 dark:bg-sky-900/40
																text-sky-700 dark:text-sky-300
															"
															aria-label="USD"
														>
															<DollarSign className="w-4 h-4" />
														</div>
													</>
													
												)
											}
											

											{/* MAX pill */}
											{!loading && !showPayConfirm && !isOnramp && (
												<button
													type="button"
													onClick={() => {
														// 这里替换成你的最大可用余额
														
														setAmount(formatMoney(usdcbalance))
														setSendError('')
														checkBalance()
													}}
													className="
														px-2.5 py-1
														rounded-full
														text-[10px] font-semibold
														text-sky-700 dark:text-sky-300
														bg-sky-100/80 dark:bg-sky-900/40
														hover:bg-sky-200/80 dark:hover:bg-sky-900/60
														active:scale-95
														transition-all duration-150
													"
												>
													MAX
												</button>
											)}
											</div>

											{/* 右侧：Delete / Clear */}
											{amount && !loading && !showPayConfirm && (
												<button
													type="button"
													onClick={() => {
														setAmount('0')
														setSendError('')
													}}
													className="
														absolute right-0 top-1/2 -translate-y-1/2
														p-1.5
														rounded-full
														text-slate-400 hover:text-slate-600
														active:scale-90
														transition
													"
													aria-label="Clear amount"
												>
													<XCircle className="w-5 h-5" />
												</button>
											)}

											{/* 金额输入框：真正锁中轴 */}
											<input
												ref={amountInputRef}
												type="text"
												inputMode="decimal"
												pattern="[0-9]*[.,]?[0-9]*"
												autoComplete="off"
												enterKeyHint="done"
												value={amount}
												onChange={e => {
													const raw = e.target.value

													// 只允许数字和一个小数点
													let v = raw
														.replace(/[^0-9.]/g, '')
														.replace(/(\..*)\./g, '$1')

													// ⭐ 关键逻辑：
													// 如果旧值是 "0"，且新输入不是 "."，则去掉前导 0
													if (amount === '0' && v !== '0' && !v.startsWith('0.')) {
														v = v.replace(/^0+/, '')
													}

													// 防止变成空字符串（比如从 0 输入 5 → ""）
													if (v === '') v = '0'

													setSendError('')
													setAmount(v)
													checkBalance()
												}}
												readOnly={loading || showPayConfirm}
												className="
													w-full
													text-[32px] leading-none font-semibold
													text-slate-900
													bg-transparent outline-none
													text-center
													selection:bg-sky-200
													px-16
													border-b border-slate-400/20
												"
											/>
										</div>
									</div>

									<div className="flex gap-2">
										<button
											type="button"
											onClick={onBack}
											className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 bg-white"
										>
											Back
										</button>
										<button
											type="button"
											onClick={onNext}
											className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
										>
											Continue to Coinbase
										</button>
									</div>

			{/* TODO: 在这里实际调用后端生成 coinbaseUrl，然后 window.location.href = url */}
			</>
		);
		};

		const StepResult: React.FC<{
			mode: RampMode;
			onBackHome: () => void;
			onRestart: () => void;
		}> = ({ mode, onBackHome, onRestart }) => {
		const isOnramp = mode === "onramp";
		

		return (
			<>
			<div className="space-y-2 text-center">
				<div className="flex items-center justify-center">
					<div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
						<svg
						className="h-5 w-5 text-emerald-500"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						>
						<path
							d="M20 6L9 17l-5-5"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						</svg>
					</div>
				</div>
				<h2 className="text-sm font-semibold text-slate-900">
					{isOnramp ? "Deposit in progress" : "Cash out initiated"}
				</h2>
				<p className="text-xs text-slate-600">
				{isOnramp
					? "Your USDC will arrive from Coinbase once your payment is complete."
					: "Your USDC was sent to Coinbase. Fiat payout to your bank is handled by Coinbase."}
				</p>
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					onClick={onBackHome}
					className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 bg-white"
				>
					Back to Home
				</button>
				<button
					type="button"
					onClick={onRestart}
					className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
				>
					Start another
				</button>
			</div>
			</>
		)
	}

export default CoinbaseRamps;
