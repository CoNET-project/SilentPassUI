import { useState, useRef, useEffect } from "react"
import {ConformSignInfo} from '@/pages/History/conformX402Sign'
import base_ex from '@/components/assets/base-ex.svg'
import {AppButton}  from '@/components/button/AppButton'
import { CoNET_Data } from "@/utils/globals"
import { useDaemonContext } from "@/providers/DaemonProvider"
import bIcon from '@/components/assets/32x32.svg'
import {ethers} from 'ethers'

import {formatAmountReadable, formatWithThousands, estimateGasUSDC, generateCODE, getBalance, AuthorizationSign} from '@/services/beamio'

type Step = "form" | "sign" | "processing" | "generated" | "x402Sign" | "success"

type Props = {
	
	id?: string
	amt: string
	note?: string
	recipient: string
	code: string
	  closeWin: () => void
}

type TipInputProps = {
	tipAmount: string
	setTipAmount: (v: string) => void
	amt: string
	tipError: boolean

}

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
          onChange={(e) => {
            const v = e.target.value
            setTipAmount(v)
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
              setTipAmount(t.toFixed(2))
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

const PayForm = ({note, amt, recipient, code, closeWin}: Props) => {
	const { darkModle, setDarkModle, setProfiles, setPower, profiles } = useDaemonContext()
	const [successPayLink, setSuccessPayLink] = useState<string>('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [messageData, setMessageData] = useState<any>()
	const [processError, setProcessError] = useState('')
	const [processing, setProcessing] = useState(false)
	const [tipAmount, setTipAmount] = useState("0.00"); // Request 模式的 tip
	const [tipError, setTipError] = useState(false)
	const [error, setError] = useState<string>("")
	const [amount, setAmount] = useState<string|undefined>(amt)
	const [myAddress, setMyAddress] = useState('')

	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSD, setUsdcToUSD] = useState(0)
	const [showPayButton, setShowPayButton] = useState(true)
	const [step, setStep] = useState<Step>("form")

	const totalAmount = Number(tipAmount) + Number(amount)

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
			<div className="mb-3">
					<div className="flex items-center justify-between mb-1">
						<label className="block text-[11px] text-slate-500">Request Account</label>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
						
						<span className="text-lg font-semibold text-slate-900 tracking-tight">{fmtAddr(recipient)}</span>
					</div>
				</div>
				<div className="mb-3">
					<div className="flex items-center justify-between mb-1">
						<label className="block text-[11px] text-slate-500">Request Amount</label>
						<span className="text-[11px] text-slate-400">USDC on Base</span>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
						<span className="text-[12px] text-slate-500">You will pay</span>
						<span className="text-lg font-semibold text-slate-900 tracking-tight">{amount}</span>
					</div>
				</div>
			</>

				
		)
	}

	const Paymentbreakdown = () => {
		return (
			<div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Request amount</span>
              <span className="text-slate-900 font-medium"> {amount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Tip</span>
              <span className="text-slate-900 font-medium">{tipAmount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Gas fee</span>
              <span className="text-emerald-600 font-medium">Sponsored by Beamio</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 mt-1">
              <span>Total from your wallet</span>
              <span className="text-slate-900 font-semibold">{totalAmount.toFixed(2)} USDC</span>
            </div>
          </div>
		)
	}

	const signRequest = async (messageDataRe: any) => {
		setProcessing (true)
		
		const paymentHeader = await AuthorizationSign(messageDataRe.maxAmountRequired, messageDataRe.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = messageDataRe.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setProcessing (false)
			if (!secondResponse.ok) {
				return setProcessError('RPC Error!')
			}
			const _amount = Number(ethers.formatUnits(messageDataRe.maxAmountRequired, 6)).toFixed(2)
			setAmount (_amount)

			
			setSignx402Show(false)
			return setSuccessPayLink(body.USDC_tx)
		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC Error!')
			
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
		setStep('form')

	}

	useEffect(() => {
		getBa()
		window.addEventListener("sign:final", onSignFinal)

		return () => {
			window.removeEventListener("sign:final", onSignFinal)
		}
	}, [profiles])

	useEffect(() => {
		
		if ( totalAmount > usdcAmount) {
			return setError('Insufficient balance')
		}
		return setError('')
	}, [tipAmount, usdcAmount])

	useEffect(() => {
		
		if ( !error && !processError) {
			return 
		}
		setTimeout(() => {
			setError('')
			setProcessError('')
			setShowPayButton(true)
		}, 4000)

	}, [error, processError])

	const getBa = async () => {
		if (!profiles?.length) {
			return
		}
		const temp = profiles[0]

		if (!temp?.keyID) return

		setMyAddress(temp.keyID)
		const _ba = await getBalance(temp.keyID)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcToUSD = usdc * Number(ba.oracle.eth.usdc)
		setUsdcToUSD(usdcToUSD)
	}

	const Header = () => {
		return (
					<div className="flex items-center justify-between mb-3">
					<div className="flex flex-col">
						<span className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
						Beamio
						</span>
						<h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
						Payments
						</h1>
					</div>

					<div className="text-right">
						<p className="text-[12px] font-medium text-slate-900 dark:text-slate-100">
						USDC {formatWithThousands(usdcToUSD)}
						</p>
						<p className="text-[11px] text-slate-500 dark:text-slate-400">
						Available on Base
						</p>
					</div>
				</div>
		)

	}

	const payLinkClick = async (reject: boolean) => {

		if ( !reject && (!myAddress|| !amt ) || error) {
			return
		}

		const total = Number(tipAmount) + Number(amount)
		if ( !reject && total > usdcAmount) {
			return setError('Insufficient balance')
		}
		if (reject) {
			setShowPayButton(false)
			setPower(true)
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

		
		const fixedAmount = ethers.parseUnits(totalAmount.toFixed(2), 6)
		const params = new URLSearchParams({ amount: reject ? '0' : fixedAmount.toString(), code }).toString()
		const path = `/api/BeamioPaymentLinkFinish?${params}`
		const requestEndpoint = 'https://api.settleonbase.xyz' + path

		
		
		try {
			
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			
			if (response.status == 200 && reject) {
				setProcessing(false)
				setShowPayButton(true)
				return setSuccessPayLink('success')

			}

			if (response.status !== 402) {
				setProcessing(false)
				setError('RPC Error!')
				return
			}


			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			MessageData.reqUrl = requestEndpoint
			

			const gas: any = await estimateGasUSDC (totalAmount, recipient)
			if (!gas) {
				setProcessing(false)
				return setError('RPC Error!')
			}

			const gasCostEth = Number(ethers.formatEther(gas.gas * gas.price))
			
			const ethPrice = gas.oracle.eth.eth
			const price = Number(gasCostEth) * ethPrice
			
			console.log (gas.oracle)
			MessageData.gas = {
				gasETH: gasCostEth.toFixed(7),
				gasUSD: price.toFixed(5)
			}
			
			setProcessing(false)
			setSignx402Show(true)
			setMessageData(MessageData)
			
		} catch (ex) {
			setProcessing(false)
			setProcessError('RPC Error!')
		}
		
		
	}

	return (
		<>

			{
				signx402Show ?
				<ConformSignInfo originUrl='https://beamio.app' messageData={messageData} processError={processError} processing={processing} /> 
				:
				<div className="p-5 space-y-5">
					{
						successPayLink ?  <>
							<div className="w-full mt-3">
								<div
								className="
									relative
									w-full
									rounded-2xl
									border border-black/10
									bg-white/80 dark:bg-slate-900/80
									backdrop-blur-md
									shadow-lg
									px-4 py-4
									text-xs
									text-black/70 dark:text-slate-100
								"
								>
								{/* 右上角关闭按钮 */}
								<button
									type="button"
									onClick={() => {
										closeWin()
									}}
									className="
									absolute -top-2 -right-2
									w-7 h-7
									rounded-full
									flex items-center justify-center
									text-[12px]
									bg-black/5 dark:bg-white/10
									text-slate-600 dark:text-slate-200
									shadow
									hover:bg-black/10 dark:hover:bg-white/20
									transition
									"
								>
									✕
								</button>

								<h2 className="text-sm font-semibold text-black/80 dark:text-slate-50 mb-1">
									{successPayLink && /^0x[0-9a-fA-F]{64}$/.test(successPayLink)
									? "Successful:"
									: "Reject Successful"}
								</h2>

								<div className="flex flex-wrap items-center gap-1 text-[11px]">
									<span>Success at：</span>

									<span>
									{new Date().toLocaleString(undefined, {
										year: "numeric",
										month: "2-digit",
										day: "2-digit",
										hour: "2-digit",
										minute: "2-digit",
										second: "2-digit",
									})}
									</span>

									{successPayLink && /^0x[0-9a-fA-F]{64}$/.test(successPayLink) && (
									<a
										href={`https://basescan.org/tx/${successPayLink}`}
										target="_blank"
										rel="noreferrer"
										className="
										ml-2 inline-flex items-center justify-center
										rounded-md border border-blue-500
										px-1.5 py-0.5
										text-[11px]
										hover:bg-blue-600 hover:text-white
										transition
										"
									>
										<img src={base_ex} alt="" className="w-4 h-4" />
										<span className="sr-only">View on BaseScan</span>
									</a>
									)}
								</div>
								</div>
							</div>
					
						</>
						: <>
							<Header />
							{
								note && <ShowNode />
							}
							
							<ShowAmount />
							<TipInput
								tipAmount={tipAmount}
								setTipAmount={setTipAmount}
								amt={amt}
								tipError={tipError}
							 />
							
							{error ? (
								<div className="mt-2 text-[13px] text-red-600" aria-live="polite">
									{error}
								</div>
							) : null}

							<Paymentbreakdown />
							{
								
								(!processing || showPayButton) && <AppButton
									disabled={!!error}
									fullWidth
									errorText={processError}
									loading={processing}
									onClick={() => {

										if (!!error) {
											return
										}

										
										payLinkClick(false)

									}}
								>
									Pay {totalAmount} USDC with Beamio
								</AppButton>
							}
							{
								(!processing || !showPayButton) &&  <AppButton
									variant='secondary'
									disabled={!!error}
									fullWidth
									errorText={processError}
									loading={processing}
									onClick={() => {
										payLinkClick(true)
									}}
								>
									Reject request
								</AppButton>
							}
							
						</>
					}
				</div>
			}
		</>
	)
}


export default PayForm