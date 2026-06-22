import { IpfsImg } from '@/components/IpfsImg';
import { useState, useRef, useEffect, useMemo } from "react"
import {ConformSignInfo} from '@/pages/History/conformX402Sign'
import base_ex from '@/components/assets/base-ex.svg'
import {AppButton}  from '@/components/button/AppButton'
import { useNavigate, useLocation } from 'react-router-dom'
import { useDaemonContext } from "@/providers/DaemonProvider"
import bIcon from '@/components/assets/32x32.svg'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {ethers} from 'ethers'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import {formatAmountReadable, formatWithThousands, estimateGasUSDC, AuthorizationSign, searchUsername, postBeamio, storeSystemData} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrencyV2'
import {CURRENCY_META, fiatPrefix} from '@/services/currency'
import { tu } from '@/locale/beamioLocale'
import { CONET_RPC_URL } from '@/config/chainAddresses'



type Step = "form" | "sign" | "processing" | "generated" | "x402Sign" | "success"

type Props = {
	
	code: string
	  closeWin: () => void
}

type TipInputProps = {
	tipAmount: string
	setTipAmount: (v: string) => void
	amt: string
	tipError: boolean

}

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider(CONET_RPC_URL),
	
}
function formatAmount(v: number, c: ICurrency) {
	if (!isFinite(v)) return `0 ${c}`
	return `${c ==='TWD'||c==='JPY' ? v.toFixed(0) : c ==='USDC' ? v.toFixed(4) : v.toFixed(2)}`
}



const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}


const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")
const TipInput = ({ tipAmount, setTipAmount, amt, tipError}: TipInputProps) => {
	return (
		<div className="mb-5">
		<div className="flex items-center justify-between mb-1">
			<label className="block text-[11px] text-slate-500">Tip (optional)</label>
			<span className="text-[10px] text-slate-400">Added on top of the amount</span>
		</div>

		<div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 flex items-center mb-2">
			<span className="text-[11px] text-slate-400 mr-2">USDC</span>
			<input
			value={tipAmount}
			placeholder="0.00"
			className={
				"flex-1 bg-transparent text-[12px] text-right placeholder:text-slate-300 focus:outline-none " +
				(tipError
				? "border border-red-300 bg-red-50/40 text-red-700 rounded-xl"
				: "border border-transparent")
			}
			readOnly
			onChange={(e) => {
				// const v = e.target.value
				// setTipAmount(v)
				// 校验逻辑写这里
			}}
			/>
		</div>

		{/* Quick tip percentages */}
			<div className="flex items-center gap-2 text-[11px]">
				{[0, 15, 18, 20].map((p) => (
				<button
					key={p}
					type="button"
					className="
					flex-1 px-2.5 py-1 
					rounded-full border 
					border-slate-300 dark:border-slate-600 
					text-slate-700 dark:text-slate-200 
					bg-slate-900/5 dark:bg-black/40 
					hover:border-slate-500 dark:hover:border-slate-300 
					transition text-center
					"
					onClick={() => {
						const _amt = Number(amt)
						const base = isNaN(_amt) ? 0 : _amt
						const t = base > 0 ? base * (p / 100) : 0
						// setTipAmount(t.toFixed(2))
					}}
				>
					{p}%
				</button>
				))}
			</div>
			<p className="text-[10px] text-slate-500">
				Choose a quick tip or leave it empty. Tips go directly to the merchant.
			</p>
		</div>
	)
}

const formatCurrencyAmount = (n: number, c: ICurrency) => {
	const decimals = (c === "JPY" || c==='TWD') ? 0 : 2
	if (!Number.isFinite(n)) return "0"
	return n.toFixed(decimals)
}



const PayForm = ({code, closeWin}: Props) => {
	const { darkModle, setDarkModle, setProfiles, setPower, profiles, usdcbalance, usdcToUSD, setMyAddress, myAddress, currencyData, beamio, setBeamio } = useDaemonContext()
	const navigate = useNavigate()
	const [successPayLink, setSuccessPayLink] = useState<string>('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [messageData, setMessageData] = useState<any>()
	const [processError, setProcessError] = useState('')
	const [processing, setProcessing] = useState(false)
	const [tipAmount, setTipAmount] = useState("0.00"); // Request 模式的 tip
	const [tipError, setTipError] = useState(false)
	const [error, setError] = useState<string>("")
	const [amount, setAmount] = useState<string>('')
	const [showPayButton, setShowPayButton] = useState(true)
	const [step, setStep] = useState<Step>("form")
	const [fromBeamio, setFromBeamio] = useState<searchResult|null>(null)
	const [requestCurrency, setRequestCurrency] = useState<ICurrency>('USD')
	const [crrency, setCurrency] = useState<ICurrency>('USD')
	const [requestToUSDC, setRequestToUSDC] = useState('')
	const [amountError, setAmountError]  = useState(false)
	const [focusAmount, setFocusAmount] = useState(false)
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [successHash, setSuccessHash] = useState('')

	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))
	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	const handleSaveAvatar = async (curr: ICurrency) => {
		if (!CoNET_Data||!beamio ) return
		
		const tmpData = CoNET_Data
		
		const profile: profile = tmpData.profiles[0]
		const bo = beamio
		bo.currency = curr
		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})
	}

	const ShowNode = () => {
	
		return (
			<div className="mb-3">
				<label className="block text-[11px] text-slate-500 mb-1">Notes</label>
				<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-800 text-center">
					{note}
				</div>
			</div>
		)
	}

	const ShowAmount = () => {
		return (

			<>
				{
					Number(amt) > 0 ? (
						<div className="mb-3 mt-4">
							<div className="flex items-center justify-between mb-1">
								<label className="block text-[11px] text-slate-500">Request Amount</label>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
								{/* 左侧：法币金额（放大） */}
								<span className="text-[16px] font-semibold text-slate-900">
									{fiatPrefix(requestCurrency)} {formatAmount(Number(amt), requestCurrency)}
								</span>

								{/* 右侧：USDC */}
								<div className="flex flex-col items-end leading-tight">
									<span className="font-mono font-semibold text-[14px] text-black/70">
										{requestCurrency !== 'USDC' ? currencyToUsdcAmount(Number(amt), requestCurrency).toFixed(4) : ''} USDC
									</span>

									{/* 预留副行（未来可开） */}
									{/*
									<span className="text-[12px] text-slate-500 tabular-nums">
										≈ {payUsdc} USDC
									</span>
									*/}
								</div>
							</div>
							{/* 右侧：两行，右对齐 */}
								
							
						</div>
					): (
						<div className="mb-3 mt-4">
							<div className="flex items-center justify-between mb-1">
								<label className="block text-[11px] text-slate-500">Entry Amount</label>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
								<AmountCurrency 
										amount={tipAmount} 
										setAmount={setTipAmount}
										readOnly={processing} 
										showLimit={0.02}
										setError={setAmountError}
										showMax={false}
										needBalance={false}
										focusSignal={focusAmount}
										currencyUSDC={true}
									/>
								
							</div>
						</div>

					)
				}
				
				
			</>

				
		)
	}

	const Paymentbreakdown = () => {
		if (!messageData) {
			return(<></>)
		}
		const data = messageData.data
		return (
			<div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 space-y-1.5 mt-4">
				<div className="flex justify-between">
					<span>Request amount</span>
					<span className="text-slate-900 font-medium"> {data.amount} USDC</span>
				</div>
				{/* <div className="flex justify-between">
					<span>Tip</span>
					<span className="text-slate-900 font-medium">{tipAmount} USDC</span>
				</div> */}
				<div className="flex justify-between">
					<span>网络费</span>
					<span className="text-emerald-600 font-medium">Sponsored by Beamio</span>
				</div>
				<div className="flex justify-between pt-1 border-t border-slate-200 mt-1">
					<span>Total from your wallet</span>
					<span className="text-slate-900 font-semibold">{requestCurrency !== 'USDC' ? currencyToUsdcAmount(Number(amt), requestCurrency).toFixed(4): amt} USDC</span>
				</div>
				
          	</div>
		)
	}

	const signRequest = async (messageDataRe: any) => {
		setProcessing (true)
		const data = messageDataRe.data
		const paymentHeader = await AuthorizationSign(data.amount, messageDataRe.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = data.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setProcessing (false)
			if (!secondResponse.ok) {
				return setProcessError((body as { error?: string })?.error ?? 'RPC 错误！')
			}
			setSignx402Show(false)
			return setSuccessPayLink(body.USDC_tx)
		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC 错误！')
			
		}

	}

	const onSignFinal = async (e: any) => {
		
		const { action, messageDataRe } = e.detail || {}

		if (action === "sign") {
			console.log("✅ 用户点击签名")
			return signRequest(messageDataRe)
		}
		setProcessing(false)
		console.log("❌ 用户取消签名")
		
		setSignx402Show (false)
		setStep('form')
	}

	let process = false
	useEffect(() => {
		if (process) {
			return
		}
		process = true
		if (!profiles?.length) {
			return
		}
		
		const profile: profile = profiles[0]
		if (!myAddress) {
			setMyAddress(profile.keyID)
		}
		getBeo()
		
	}, [])

	useEffect(() => {
		if (!processError) return
		setTimeout(() => {
			setMessageData('')
			setProcessError('')
		}, 2000)
	}, [processError])



	const Header = () => {
		return (
				<div className="flex items-center justify-between mb-3">
					<div className="flex flex-col">
						<span className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
							Beamio
						</span>
						<h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
							Payments Request
						</h1>
					</div>

					<div className="text-right">
						<p className="text-[12px] font-medium text-slate-900 dark:text-slate-100">
							USDC {formatWithThousands(usdcbalance)}
						</p>
						<p className="text-[11px] text-slate-500 dark:text-slate-400">
							Available on Base
						</p>
					</div>
				</div>
			)

	}

	const payLinkClick = async () => {
		const amount = Number(requestCurrency !== 'USDC' ? currencyToUsdcAmount(Number(amt), requestCurrency).toFixed(4): amt)
		if ( amount === 0 || amount > usdcbalance) {
			return setError('余额不足')
		}
		

		setProcessing(true)

		/**
		 * 			test uint
		 */

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setShowPayButton(true)
		// 	setError("An error occurred, please try again later")
		// }, 2000)

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessPayLink('0xb0be7e96fa60ca055c777884453270cecb82bc7ab237c6b831d98fb77b84ef0d')
			
		// }, 2000)

		
		const fixedAmount = ethers.parseUnits(amount.toFixed(4), 6)
		const params = new URLSearchParams({ amount: fixedAmount.toString(), code }).toString()
		const path = `/api/BeamioPaymentLinkFinish?${params}`
		const requestEndpoint = 'https://api.settleonbase.xyz' + path

		
		
		try {
			
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			
			if (response.status == 200) {
				setProcessing(false)
				setShowPayButton(true)
				return setSuccessPayLink('success')

			}

			if (response.status !== 402) {
				setProcessing(false)
				setError('RPC 错误！')
				return
			}


			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			const data = {
				node: note,
				sginTatle: 'Cashcode',
				reqUrl: requestEndpoint,
				amount: fixedAmount

			}
			MessageData.data = data
			setMessageData(MessageData)
			setProcessing(false)
			

			// const gas: any = await estimateGasUSDC (totalAmount, recipient)
			// if (!gas) {
			// 	setProcessing(false)
			// 	return setError('RPC 错误！')
			// }

			// const gasCostEth = Number(ethers.formatEther(gas.gas * gas.price))
			
			// const ethPrice = gas.oracle.eth.eth
			// const price = Number(gasCostEth) * ethPrice
			
			
			// MessageData.gas = {
			// 	gasETH: gasCostEth.toFixed(7),
			// 	gasUSD: price.toFixed(5)
			// }

			
		} catch (ex) {
			setProcessing(false)
			setProcessError('RPC 错误！')
		}
		
		
	}

	const getBeo = async () => {
		if (!beamio || !CoNET_Data) {
			return
		}
		setCurrency(beamio.currency)
		try {
			const [fx] = await Promise.all([
				CoreContract.getLinkMemo(code)
			])
			
			const amount = Number(ethers.formatUnits(fx.amount, 6))
			const note: string = fx.node
			const _currency: ICurrency = note.split('\r\n')[1] as ICurrency ||'USDC'
			setRequestCurrency(_currency||'USDC')
			setAmt(amount.toFixed(4))
			setNote(note.split('\r\n')[0])
			setRecipient(fx.to)
			const data = await searchUsername(fx.to)||[]
			if (data?.results?.length) {
				setFromBeamio({...data.results[0]})
			}

			if (_currency !== 'USDC') {
				const requestUSDC = Number(currencyToUsdcAmount(Number(amt), requestCurrency).toFixed(4))
				setRequestToUSDC(requestUSDC.toString())
			} else {
				setRequestToUSDC(amount.toFixed(4))
			}

			
			

		} catch (ex) {
			console.log(``)
		}
		
	}

	const SuccessPayment = () => {
		const data = messageData.data
		return (
			 <div className="flex flex-col bg-slate-50 text-slate-900">
				{/* Header */}
				<header className="flex items-center justify-between px-6 pt-4 pb-3 border-slate-100">
					<div className="flex flex-col gap-0.5">
					<span className="text-[11px] tracking-[0.18em] text-slate-500 uppercase">
						Beamio
					</span>
					<h1 className="text-lg font-semibold text-slate-900">Payments</h1>
					</div>
				</header>

				<main className="flex-1 px-6 pt-10 pb-24 flex flex-col items-center">
					{/* Check icon */}
					<div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
						<span className="text-3xl text-white">✓</span>
					</div>

					<h2 className="text-base font-semibold text-slate-900 mb-1 text-center">
						Payment successful
					</h2>

					<p className="text-[13px] text-slate-500 mb-4 text-center">
						You just paid
					</p>

					<p className="text-3xl font-semibold text-slate-900 mb-2 text-center">
						{data.amount} USDC
					</p>

					{/* <p className="text-[11px] text-slate-500 mb-6 text-center max-w-xs">
						The recipient received {amount} USDC. Any Beamio service fee was
						already handled in their Payment Link. Network fees were paid by
						Beamio.
					</p> */}

					{/* 跟在说明文字下方 */}
					<div className="w-full mt-4 flex flex-col gap-2">
						<AppButton
						fullWidth
						variant='primary'
						onClick={() => {
							closeWin()
						}}
						>{tu('done')}</AppButton>

						<AppButton
						fullWidth
						variant='secondary'
						onClick={() => {
							window.open(`https://basescan.org/tx/${successPayLink}`, '_blank', 'noopener,noreferrer')
						}}
						>{tu('view_transaction')}</AppButton>
					</div>
					</main>
			</div>
		)
	}

	const SenderBmo = () => {
		if (!fromBeamio) {
			return (<></>)
		}

		const fallback = typeof getImg === 'function' ? getImg(fromBeamio?.image||'') : ''
		return (
				<button
					key={fromBeamio?.username}
					type="button"
					className="
						w-full
						flex items-center gap-2
						rounded-full
						border border-slate-200
						bg-slate-50
						px-3 py-2
						text-left
						hover:bg-slate-100
						active:scale-[0.98]
						transition
					"
				>
					{/* Avatar */}
					<IpfsImg
						src={fromBeamio?.image || fallback}
						alt={fromBeamio?.username}
						className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-slate-200"
					/>

					{/* 左侧：用户名 / @handle（必须 flex-1 + min-w-0） */}
					<span className="flex-1 min-w-0">
						<span className="block text-[12px] text-slate-900 truncate">
							{fromBeamio ? displayName(fromBeamio) : ""}
						</span>
						<span className="block text-[10px] text-slate-500 truncate">
							@{fromBeamio?.username}
						</span>
					</span>

					{/* 右侧：金额（整行最右 + 粗体） */}
					{/* <span
						className="
							ml-auto
							flex-shrink-0
							text-right
							text-[12px]
							font-semibold
							tabular-nums
							text-slate-900
							text-[16px]
						"
					>
						{amount} USDC
					</span> */}
				</button>)
	}

	return (
		
		<div
			className="
				
				px-6 pt-8 pb-16 overflow-auto
			"
		>

			{
				 <div className="">
					{
						successPayLink ?  <>
							<SuccessPayment />
						</>
						: <div >
							<Header />
							{
								fromBeamio && <SenderBmo />
							}
							{
								note && <ShowNode />
							}
							
							<ShowAmount />
							{/* <TipInput
								tipAmount={tipAmount}
								setTipAmount={setTipAmount}
								amt={amt}
								tipError={tipError}
							 /> */}
							
							{error ? (
								<div className="mt-2 text-[13px] text-red-600" aria-live="polite">
									{error}
								</div>
							) : null}

							<Paymentbreakdown />
							<div className="flex items-center gap-3 mt-3 mb-6">
							
							{
								(!processing && !processError) &&  <AppButton
									variant='secondary'
									disabled={!!error}
									fullWidth
									loading={processing}
									onClick={() => {
										closeWin()
									}}
								>{tu('cancel')}</AppButton>
							}
							{
								
								(!processing || showPayButton) && 
									<AppButton
										disabled={!!error}
										fullWidth
										errorText={processError}
										loading={processing}
										onClick={() => {

											if (!!error) {
												return
											}
											if(!messageData) {
												return payLinkClick()
											}
											
											signRequest(messageData)
										}}
									>
										{!messageData ? '继续' : 'Payment'}
									</AppButton>
							}
							</div>
							
						</div>
					}
				</div>
			}
			{/* 底部留白占位 */}
  			<div className="h-12" />
		</div>
	)
}


export default PayForm