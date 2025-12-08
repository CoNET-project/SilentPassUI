import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle, memo } from "react"
// import {formatAmountReadable, generateCODE, formatWithThousands, getBalance} from '../util/utils'

import HumanReadableAmount from './HumanReadableAmount'
import { Copy } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import cashcodeIcon from '@/components/assets/32x32.svg'
import base_ex from '@/components/assets/base-ex.svg'
import {ethers} from 'ethers'
import {ConformSignInfo} from '../History/conformX402Sign'
import {formatAmountReadable, formatWithThousands, generateCODE} from '@/services/beamio'
import {AppButton} from '@/components/button/AppButton'
import { CoNET_Data } from "@/utils/globals"
import { useDaemonContext } from "@/providers/DaemonProvider"
import ReceiveOverlay from '@/pages/History/ReceiveOverlay'
import {LinkHistoryTable} from './history'
import CheckInputSection from './CheckInputSection'



const isLocal = false
const localUrl = "http://localhost:4088"
const remoteUrl = "https://api.settleonbase.xyz"
const aptEndpoint = isLocal ? localUrl : remoteUrl

const showPaylinkSite = 'https://beamio.app'


type Props = {
	currency?: string                 // 左上角，如 USDC
	defaultAmount?: number            // 初始金额
	validityDays?: number             // 有效期天数
	cancellable?: boolean             // 右下角“可止付”提示
	// 可传入项目里的 t；若不传，使用组件内置的 t

}

type CheckValues = {
	amount: string
	secureCode: string;
	note: string
}

const currency = 'USD'

const defaultNote = 'This is a Beamio payment test'
export type CheckHandle = {
	/** 立即获得当前值 */
	getValues: () => CheckValues
	/** 方便外部把焦点放到金额输入框 */
	focusAmount: () => void
}

const copy = async (text: string): Promise<void> => {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
	// noop
	}
}


const Check = forwardRef<CheckHandle, Props>(function Check({
	defaultAmount = 1.0,
	validityDays = 7,
	cancellable = true
}: Props, ref) {

	const MemoizedHistoryTable = memo(LinkHistoryTable)
	const MemoizedReadableAmount = memo(HumanReadableAmount)

	const { profiles } = useDaemonContext()
	const [amount, setAmount] = useState<string>(defaultAmount.toFixed(2))
	const [secureCode, setSecureCode] = useState<string>("")
	const [redeemCode, setRedeemCode] = useState<string>("")
	const [redeemHash, setRedeemHash] = useState<string>("")
	const [note, setNote] = useState<string>(defaultNote)

	const [error, setError] = useState<string>("")
	const inputRef = useRef<HTMLInputElement | null>(null)
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	
	const [result, setResult] = useState('')
	const [process, setProcess] = useState(false)
	const [secureError, setSecureError] = useState<string>("")

	const [explorerUrl] = useState<string>('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [showIssue, setShowIssue] = useState(false)
	const [requestUrl, setRequestUrl] = useState('')
	const [messageData, setMessageData] = useState()
	const [processMode, setProcessMode] = useState<'check'|'link'>('check')
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)

	const showCheck = ((!process && !error) || processMode === 'check')
	const showLink = ((!process && !error) || processMode === 'link')

	// 当前应该显示几个按钮
	const count = (showCheck ? 1 : 0) + (showLink ? 1 : 0)

	// 若 count === 2 → 每个按钮 w-1/2
	// 若 count === 1 → 只有一个按钮 → w-full
	const btnWidth = count === 2 ? "w-1/2" : "w-full"


	const { fee, net } = useMemo(() => {
		const amt = Number(String(amount).replace(/,/g, "")) || 0

		// 0.8% 手续费
		let feeVal = amt * 0.008

		// 最低 0.02，最高 2.00
		feeVal = Math.max(0.02, Math.min(feeVal, 2.00))

		const netVal = Math.max(amt - feeVal, 0)

		return { fee: feeVal, net: netVal }
	}, [amount])

	useImperativeHandle(ref, () => ({
		getValues: () => ({
			amount,
			secureCode,
			note
		}),
		focusAmount: () => {
			
		}
   	}), [amount, secureCode, note])

	useEffect(() => {
		if (!error) {
			return
		}

		setTimeout(() => {
			setError('')
		}, 3000)

	}, [error])
	
	useEffect(() => {

	}, [])


	const handleNoteFocus = () => {
		// 若当前是默认文案，则清空便于输入
		if (note === defaultNote) setNote("")
	}

	const insufficient = Number(amount) > usdcAmount

	const handleNoteBlur = () => {
		// 若为空或只含空格，恢复默认文案
		if (note.trim() === "") setNote(defaultNote)
	}

	const parsed = useMemo(() => Number(amount.replace(/,/g, "")), [amount])

	const readable = useMemo(() => {
		const result = formatAmountReadable(Number(parsed || 0), 'en', 'usd')
		return result
	}, [parsed])

	const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })



	const readableNet = useMemo(() => {
		return formatAmountReadable(Number(net || 0), 'en', 'usd')
	}, [net])

	const handleBlur = () => {
		const v = Number(String(amount).replace(/,/g, ""))

		if (isNaN(v)) {
			setError("Please enter a valid number")
			return false
		}
		if (v <= 0.02) {
			setError("Amount must be ≥ 0.02")
			
			return false
		}
		
		//   // ✅ 增加：不能超过 1000 美元
		// if (v > 1000.1) {
		// 	setError(t("金额不能超过1000美元", "Amount must not exceed 1000 USD", "金額は1000ドルを超えてはいけません"))
		// 	requestAnimationFrame(() => {
		// 	inputRef.current?.focus()
		// 	inputRef.current?.select()
		// 	})
		// 	return
		// }
		// 格式化
		setAmount(formatWithThousands(v))
		setError("")
		return true
	}

	const generateCashCodeCCWallet = async () => {
		
		const check = handleBlur()
		
		if (process||!check||insufficient) {
			return
		}

		// setProcess(true)

		// const isLocal = false
		

		// const price = Number(String(amount).replace(/,/g, "")).toString()
		// const code = generateCODE(secureCode.replace('-',''))
		// setRedeemCode(code.code)
		// setRedeemHash(code.hash)
		// const params = new URLSearchParams({amount:price, note, secureCode, hash: code.hash}).toString()
		// const path = `/api/cashCode?${params}`
		
	
		// const remote = "https://api.settleonbase.xyz"
		// const local = "http://localhost:4088" 
		// const url = (isLocal ? local : remote) + path

		let fetchWithPayment
		// if (WallctClient) {
		// 	try {
					
		// 		fetchWithPayment = wrapFetchWithPayment(fetch, WallctClient, ethers.parseUnits(price, 6))

		// 		const response = await fetchWithPayment(
		// 			url, {
		// 				method: 'GET'
		// 			}
		// 		)
		// 		if (response?.ok) {
					
		// 			const data = await response.json()
		// 			if (data?.USDC_tx) {
						
		// 				// setExplorerUrl(`https://basescan.org/tx/${ data.USDC_tx}`)
		// 				console.log("Purchase success:", response)
		// 				const paramsRemote = new URLSearchParams({hash: code.hash, lang}).toString()
		// 				const realUrl = `${origin}?${paramsRemote}`
		// 				setResult(realUrl)
		// 			}
					

		// 		} else {
		// 			// showTermAlert("CashCode Response error", false)
		// 			console.log("❌ Response error:", response)
					
		// 		}
		// 		setProcess(false)
		// 	} catch (ex: any) {
		// 		// showTermAlert("CashCode Response error", false)
		// 		console.log(ex.message)
		// 		setProcess(false)
		// 	}
		// 	return 
		// }
		
		// setRequestUrl(url)
		// setSignx402Show(true)

	}

	const issueRequestLink = async () => {

		if (!profiles?.length) {
			return
		}
		setProcessMode('link')
		setProcess(true)
		/**
		 * 
		 * 		UI test
		 * 
		 */

		// setTimeout(() => {
		// 	setProcess(false)
		// 	setError('RPC ERROR!')
		// }, 3000)


		const profile: profile = profiles[0]
		const code = generateCODE ('')
		const fixedAmount = ethers.parseUnits(amount, 6).toString()
		const params = new URLSearchParams({amount: fixedAmount, code: code.hash, note, address: profile.keyID }).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			setProcess(false)
			if (res.status !== 200) {
				return setError(`Beamio RPC Error!`)
			}
			
			const showUrl = `${showPaylinkSite}?${params}`
			setResult(showUrl)

		} catch (ex) {
			setProcess(false)
			return setError(`Beamio RPC Error!`)
		}
		
	}


	const ShowBarcode = () => {
		const url = new URL(result)

		const barcodeAmount = Number(url.searchParams.get('amount'))
		return (
			<>
			<div className="rounded-3xl p-5 md:p-6 max-w-md mx-auto">
				{result && (
				<div className="mt-6 flex flex-col items-center gap-3">
					 {/* 右上角关闭按钮 */}
						<button
							className="
							absolute top-0 right-0
							w-8 h-8 rounded-full flex items-center justify-center
							text-lg leading-none
							bg-black/5 dark:bg-white/10
							m-3
							"
							onClick={() => {
								setShowIssue(false)
								setResult('')
							}}
						>
							✕
						</button>
					<h3 className="text-3xl font-extrabold mb-6 text-slate-900 dark:text-slate-100">
						{processMode === 'link' ? 'Payment Link' : 'Check Link'}
					</h3>
					
					<div className="p-3 rounded-2xl border border-current/15 shadow-sm bg-transparent mx-auto">
					<QRCodeCanvas
						value={result || ""}
						size={160}
						includeMargin
						imageSettings={{
							src: cashcodeIcon,
							height: 36,
							width: 36,
							excavate: true,
						}}
					/>

					<div className="flex justify-center items-center gap-1 text-[13px] mt-0 pt-0 leading-none">
						<span className="uppercase text-xs text-current/60">Amount</span>
						<span className="font-mono font-semibold text-xs text-current/80">
						{formatMoney(barcodeAmount)}
						</span>
					</div>
					</div>

					<div className="flex gap-2 mt-2">
					<a
						href={result}
						target="_blank"
						rel="noreferrer"
						className="
						border border-current
						px-3 py-1 text-xs rounded-xl
						transition
						hover:bg-black/10 dark:hover:bg-white/10
						"
					>
						Open
					</a>

					<button
						onClick={() => copy(result!)}
						className="
						border border-current
						px-3 py-1 text-xs rounded-xl
						transition
						hover:bg-black/10 dark:hover:bg-white/10
						"
					>
						Copy
					</button>

					{explorerUrl && (
						<a
						href={explorerUrl}
						target="_blank"
						rel="noreferrer"
						className="
							border border-current
							px-3 py-1 text-xs rounded-xl
							hover:bg-current/10
							transition
							inline-flex items-center justify-center
						"
						>
						<img src={base_ex} alt="Explorer" className="w-4 h-4" />
						</a>
					)}
					</div>

				</div>
				)}
			</div>
			</>
					)
	}
	


	return (
			<div
				className=""
			>
				{signx402Show ? (
					<ConformSignInfo
						messageData={{ messageData }}
						originUrl="https://beamio.app"
						processError={error}
						processing={process}
					/>
					) : !result ? (
						<div>
							{
								showIssue && (
									<div className="flex items-center justify-end px-5 pt-5 pb-2">
										<button
											className="w-8 h-8 rounded-full flex items-center justify-center 
														text-lg leading-none 
														bg-black/5 dark:bg-white/10"
											onClick={() => {
												setShowIssue(false)
											}}
										>
										✕
										</button>
									</div>
								)
							}
							
							{/* 备注输入栏 */}

							<div >
								
								<input
									type="text"
									value={note}
									onChange={e => setNote(e.target.value)}
									onFocus={handleNoteFocus}
									onBlur={handleNoteBlur}
									placeholder={defaultNote}
									className={`
										w-full bg-transparent outline-none
										text-base text-current pb-0
										placeholder:text-current/45
										border-0 border-b
										border-slate-400/30 dark:border-white/10
										focus:border-slate-600/60 dark:focus:border-white/20
										transition-colors
										${showIssue ? "opacity-60 cursor-not-allowed" : ""}
									`}
								/>
							</div>

							<div className="rounded-3xl p-5 md:p-6 max-w-md">
								{/* 金额输入 + 人类可读 */}
								
								<input
									ref={inputRef}
									value={amount}
									inputMode="decimal"
									type="text"
									onChange={(e) => {
										console.log('change', e.target.value)
										setAmount(e.target.value)

									}}
									
									placeholder="0.00"
									style={{
										fontSize: "45px",
										textAlign: "right",
										transition: "all 0.2s ease",
									}}
									className={`
										w-full bg-transparent outline-none
										leading-none font-semibold tracking-wide
										text-inherit dark:text-inherit
										${showIssue ? "opacity-60 cursor-not-allowed" : ""}
									`}
								/>

								<MemoizedReadableAmount readable={readable} lang="en" />

								
							</div>

							{error ? (
								<div
								className="mt-2 text-[13px] text-red-600"
								aria-live="polite"
								>
								{error}
								</div>
							) : null}

							{/* 实际到账 */}
							<div className="flex items-baseline justify-between">
								<span className="text-sm text-current/70">Receive</span>
								<span className="text-[20px] font-semibold text-current">
								{formatMoney(net)} {currency}
								</span>
							</div>

							{/* 底部提示行 */}
							<div className="text-xs text-current/60 text-right -mt-1">
								Fee: {formatMoney(fee)} {currency}
							</div>

							<div className="mt-2 flex items-center justify-between text-sm text-current/70">
								<span>Valid for {validityDays} days</span>
								<span>{cancellable ? "Cancellable" : "\u00A0"}</span>
							</div>

							{/* 按钮：Generate / Show */}
							{ showIssue ? (

										<div className="flex gap-3 mt-4 mb-4">

										{showCheck && (
											<div className={btnWidth}>
												<AppButton
												variant={insufficient ? 'secondary' : 'primary'}
												loading={process}
												errorText={error}
												disabled={insufficient}         // 🔥 禁用按钮
												fullWidth
												className="my-0"
												onClick={() => generateCashCodeCCWallet()}
												>
												{insufficient ? 'Insufficient balance' : 'Generate Check'}
												</AppButton>
											</div>
										)}

										{showLink && (
											<div className={btnWidth}>
											<AppButton
												variant="primary"
												loading={process}
												errorText={error}
												fullWidth
												className="my-0"
												onClick={() => issueRequestLink()}
											>
												Request Link
											</AppButton>
											</div>
										)}

										</div>
									//			Next
									): (

										<>
											<AppButton
												variant="primary"
												loading={process}
												errorText={error}
												fullWidth
												className="my-0"
												onClick={() => {
													setShowIssue(true)
												}}
											>
												Next
											</AppButton>
										
										</>
									)
								}
								{
									!showIssue && (
										<div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
											{/* 你原来这层 */}
											<div className="flex-1 min-h-0 mt-6">
												<LinkHistoryTable itemClock={item => {
												// 这里拿到 LinkHistork 的完整数据
												console.log('clicked item', item)
												// do something...
												const params = new URLSearchParams({amount: item.amount.toFixed(2), code: item.hash, note: item.note, address: myAddress }).toString()
												const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
												setResult(requestUrl)
												setShowIssue(true)
											}} />
											</div>
										</div>
									)
								}
							
		

						</div>
				) : (
					<ShowBarcode />
				)}
			</div>

	)
})


export default Check