import React, {useRef, useState, useEffect, useMemo} from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import {
  ArrowLeft,
  Camera,
  Check,
  Search,
  ChevronRight,
  X,
  Copy,
  ExternalLink,
} from "lucide-react"
import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton";
import {motion, AnimatePresence } from "framer-motion"
import { createPortal } from 'react-dom';
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import base_ex from '@/components/assets/base-ex.svg'
import LockModeSegmented from './LockModeSegmented'
import FeeInline from './FeeInline'
import {RedeemOrLinkCard} from '@/pages/Pay/RedeemOrLinkCard'
import SuccessShow from './successShow'



const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const showPaylinkSite = 'https://beamio.app'

const defaultTextTemp = `Sent with Beamio - no gas fees.`

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(2));
}


function formatUserDate(timestamp?: string | number): string {
	if (!timestamp) return ""  // 无日期 → 空

	const num = Number(timestamp)
	if (!num) return ""        // 防止 NaN

	// 判断是秒还是毫秒（简易方式）
	const ms = num < 10_000_000_000 ? num * 1000 : num

	const d = new Date(ms)
	if (isNaN(d.getTime())) return ""  // 避免 Invalid Date

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric"
	})
}

const formatCurrencyAmount = (n: number, c: ICurrency) => {
	const decimals = (c === "JPY" || c==='TWD') ? 0 : 2
	if (!Number.isFinite(n)) return "0"
	return n.toFixed(decimals)
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
}

export default function PaymentLink ({close, beamioer}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles } = useDaemonContext()
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successUrl, setSuccessUrl] = useState("")
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [payAmount, setPayAmount] = useState("")
	const [requestNet, setRequestNet] = useState("")
	const [processError, setProcessError] = useState("")


	useEffect(() => {
		if (sendError) {
			setTimeout(() => {
				setSendError('')
			}, 2000)
		}
	}, [sendError])

	useEffect(() => {
		if (!beamio) return

		setCurrency(beamio.currency)

	}, [beamio])

	useEffect(() => {
		if (item) {
			setFocusAmount(true)
		} else {
			
		}
	}, [item])


	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}




	const issueRequestLink = async () => {

		if (!profiles?.length||!beamio) {
			return
		}
		const currency = beamio.currency
		const numberAmount = Number(sendAmount)
		if (isNaN(numberAmount) || numberAmount <= 0.02) {
			return 
		}


		

		const showCurrencyNumber = lockMode === 'USDC_LOCKED' ? numberAmount.toFixed(4) : formatCurrencyAmount(numberAmount * fxRateUSDCToCurrency(currency), currency)
		console.log(showCurrencyNumber)
		
		setProcessing(true)
			/**
			 * 
			 * 		UI test
			 * 
			 */
	
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError('RPC ERROR!')
		// }, 3000)

		const currencyData = lockMode === 'USDC_LOCKED' ? 'USDC': currency
		const showNote = note + `\r\n` + currencyData
		
		
		const profile: profile = profiles[0]
		const code = generateCODE ('')


		const fixedAmount = ethers.parseUnits(showCurrencyNumber, 6).toString()
		const params = new URLSearchParams({amount: fixedAmount, code: code.hash, note:showNote, address: profile.keyID }).toString()
		const net = numberAmount - calcFeeFromNumber(numberAmount)
		const showNetCurrency = lockMode === 'USDC_LOCKED' ? net.toFixed(4) : formatCurrencyAmount(net * fxRateUSDCToCurrency(currency), currency)
		const showparams = new URLSearchParams({code: code.hash}).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		const showUrl = `${showPaylinkSite}?${showparams}`
		setPayAmount(showCurrencyNumber)
		setRequestNet(showNetCurrency)
		/**
			 * 
			 * 		UI test
			 * 
			 */
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessUrl(showUrl)
		// }, 1000)


		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			setProcessing(false)
			if (res.status !== 200) {
				return setProcessError(`Beamio RPC Error!`)
			}
			console.log(note)
			setSuccessUrl(showUrl)

			

		} catch (ex) {
			setProcessing(false)
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}

	return (
		<div className="mt-0 flex items-center justify-between px-6 pt-4 pb-3 border-slate-100 flex-col">
			<div className="mt-2 w-full">
				<Card className="rounded-3xl border-zinc-200">
					{
						successUrl ? 
							<SuccessShow note={note} successUrl={successUrl}
								currency={currency}
								lockMode={lockMode}
								payAmount = {payAmount}
								requestNet={requestNet}
								onReset={() => {
									close('')
								}}
								
							/>
						
						 : (
							<CardContent className="p-4 space-y-4">
								<div>
									<div className="text-lg font-semibold">Create Payment Link</div>
									<div className="mt-1 text-sm text-slate-500">
										Create a request in fiat. USDC is shown as an estimate.
									</div>
								</div>

								<div className="mt-5 grid gap-3">
								<p className="text-slate-700">Amount type</p>
								<LockModeSegmented value={lockMode} onChange={val => {
									setLockMode(val)
								}} />
								</div>
								
									
									
										<section className="input">
											<AmountCurrency 
												amount={sendAmount} 
												setAmount={setSendAmount} 
												autoEntry={!!!item} 
												readOnly={processing} 
												showLimit={0.02}
												setError={setAmountError}
												showMax={false}
												needBalance={false}
												focusSignal={focusAmount}
												currencyUSDC={lockMode === 'USDC_LOCKED'}
											/>
										</section>
									
								
								 <div className="mt-5">
									<FeeInline
										payUsdc={Number(sendAmount)}
										isUSDC={lockMode ==='USDC_LOCKED' ? true : false}
									/>
								</div>


								
								{/* Note */}
								
								<textarea
									value={note}
									onFocus={(e) => {
										if (note === defaultNodeText) {
											setNote('') // 清空默认文本
										}
									}}

									readOnly={!!message}
									
									placeholder="What's this for?"
									onChange={(e) => {
										setNote(e.target.value)
									}}
									rows={2}
									className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
								/>
									
								
								
								<div className="mt-3 flex gap-3 w-full">
									
									<AppButton
										fullWidth
										onClick={issueRequestLink}
										loading={processing}
										errorText={processError}
									>

										Generate Payment Link
									</AppButton>
								</div>
								
							</CardContent>
						)
					}
					
				</Card>
			</div>
		</div>
	)
}
