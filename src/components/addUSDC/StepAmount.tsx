import { useDaemonContext } from "@/providers/DaemonProvider"
import React, { useMemo, useState, useEffect } from "react";
import { IpfsImg } from '@/components/IpfsImg';
import {useAutoFocus} from '@/components/input/useAutoFocus'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { AppButton } from "../button/AppButton";


import {
	DollarSign,
	XCircle
} from "lucide-react";

export type RampMode = "onramp" | "offramp"


const remote = 'https://beamio.app'

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const StepAmount: React.FC<{
		mode: RampMode;
		myAddress: string
		onBack: () => void;
		onNext: (url: string) => void;
	}> = ({ mode, onBack, onNext, myAddress }) => {
		const isOnramp = mode === "onramp";
				const { profiles, usdcbalance,
			} = useDaemonContext()
		const [loading, setLoading] = useState<boolean>(false)
		const [showPayConfirm, setShowPayConfirm] = useState<boolean>(false)
		const [sendError, setSendError] = useState<string>('')
		const [amount, setAmount] = useState<string>('')
		
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
		const clickNext = async () => {
			if (!myAddress) return
			setLoading(true)
			// await new Promise(executor => setTimeout(() => executor(true), 1000))
			
			const params = new URLSearchParams({address: myAddress, paymentAmount: amount}).toString()

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
				onNext( onrampUrl )
				
			} catch (e) {
				console.error('open coinbase onramp error', e)
				return 
			}
		}

		useEffect(() => {
			openAmount()
		}, [])

		

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
														<IpfsImg
															src={usdcIcon}
															alt="USDC"
															className="w-6 h-6 rounded-full"
														/>
														<IpfsImg
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
										<AppButton
											fullWidth
											variant='secondary'
											onClick={onBack}
										>
											Back
										</AppButton>

										<AppButton
											fullWidth
											onClick={clickNext}
											loading={loading}
										>
											Continue to Coinbase
										</AppButton>
										
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

export default StepAmount