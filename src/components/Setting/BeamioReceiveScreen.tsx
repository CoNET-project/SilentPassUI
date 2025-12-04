import React, {useEffect, useState} from "react";
import { useDaemonContext } from '@/providers/DaemonProvider'
import bIcon from '@/components/assets/32x32.svg'
import { QRCodeCanvas } from "qrcode.react"
import CopyButton from '@/components/button/CopyButton'
import {AppButton} from '@/components/button/AppButton'
import {formatAmountReadable, formatWithThousands, estimateGasUSDC, generateCODE, getBalance, AuthorizationSign, redeemCodeHash} from '@/services/beamio'
import RedeemSuccessScreen from '@/pages/Browser/RedeemSuccessScreen'
import { useNavigate } from "react-router-dom"
import {ethers} from 'ethers'
import { beamioCoreConet } from "@/utils/constants"
// Beamio Receive screen: show wallet address & QR to receive USDC on Base
// This is a standalone "Receive" UI, separate from the Payments (Send / Request / Check) screen.

type prof = {
	colse: () => void
}



const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const showPaylinkSite = 'https://beamio.app'
const aptEndpoint = isLocal ? local : remote


const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
export default function BeamioReceiveScreen() {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()
	const [walletAddress, setWalletAddress] = useState<string>('')
	const [account, setAccount ] = useState(beamio?.accountName)
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSD, setUsdcToUSD] = useState(0)
	const [processError, setProcessError] = useState("")
	const [valueError, setValueError] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const [securityCodeDigits, setSecurityCodeDigits] = useState("")
	const [processing, setProcessing] = useState(false)
	const [successHash, setSuccessHash] = useState("")
	const [note, setnode] = useState("")
	const [amount, setamount] = useState("")
	const navigate = useNavigate()

	const formatSecurityCode = (value: string) => {
		// 只保留数字
		const digits = value.replace(/\D/g, "").slice(0, 6)

		// 分成两段
		const left = digits.slice(0, 3).padEnd(3, "•")
		const right = digits.slice(3, 6).padEnd(3, "•")

		return `${left}-${right}`
	}

	const getCashcodeInfo = async (hash: string) => {
		
	}

	const [redeemCode, setRedeemCode] = useState('')

	const handlePaste = async () => {
		setValueError(false)
		if (redeemCode?.length ) {
			setRedeemCode ('')
			setValueError(false)
			return
		}

		try {
		if (navigator.clipboard && (navigator.clipboard as any).readText) {
			const text = await navigator.clipboard.readText()
			setRedeemCode(text)
		}
		} catch (e) {
			console.warn("Clipboard not available", e)
		}
	}


	const tryRedeem = async() => {
		setProcessing(true)
		/**
		 * 		UI test
		 */

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError(`Server error!`)
		// }, 2000)

		const hash = redeemCodeHash(redeemCode, securityCodeDigits)


		const params = new URLSearchParams({secureCode: redeemCode, securityCodeDigits, address: walletAddress }).toString()
		const endpointUrl = `${aptEndpoint}/api/redeemCheck?${params}`
		

		try {

			const cashcode = await beamioCoreConet.checkMemo(hash)
			if (cashcode?.from === ethers.ZeroAddress) {
				return setProcessError(`The entered Cashcode and Security Code could not be validated. Please try again.`)
			}

			const _amount = ethers.formatUnits(cashcode?.amount, 6)
			const _node: string = cashcode?.node
			const _node1 = _node.split('\r\n')[0]
			setnode(_node1)
			setamount(_amount)

			const res = await fetch(endpointUrl, {method: 'GET'})

			setProcessing(false)
			if (res.status !== 200) {
				return setProcessError(`The entered Cashcode and Security Code could not be validated. Please try again.`)
			}
			const result = await res.json()
			setSuccessHash(result.tx)

		} catch (ex) {
			setProcessing(false)
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}

	const getBa = async () => {
		const temp = profiles?.[0]

		if (!temp?.keyID) return

		setWalletAddress(temp.keyID)
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
	useEffect(() => {
		getBa()
	}, [])
  return (
		<div className="mt-12 flex-1 overflow-y-auto">
			{
				successHash ? (
					<RedeemSuccessScreen amount={amount} myAddress={walletAddress} hash={successHash} note={note} viewClose={() => {
						
						navigate('/')
					}} />
				) : (
					<div
						className="
						flex flex-col
						h-[calc(100%-2.5rem)]
						px-5 pb-5 
						md:px-8 md:pb-6
						"
					>
						{/* Header */}
						<div
							className="
								flex items-center justify-between mb-4
								md:mb-6
							"
						>
							<div className="flex flex-col">
								<span
									className="
										text-[10px] uppercase tracking-[0.16em]
										text-slate-400 dark:text-slate-500
										md:text-[11px]
									"
								>
									Beamio
								</span>
								<h1
									className="
										text-sm font-semibold
										text-slate-900 dark:text-slate-50
										md:text-base
									"
								>
									Receive
								</h1>
							</div>

							<div className="flex flex-col items-end">
								<span
									className="
										text-[10px] uppercase tracking-[0.16em]
										text-slate-400 dark:text-slate-500
										md:text-[11px]
									"
								>
									USDC on Base
								</span>
								<span
									className="
										text-[11px] font-medium
										text-slate-900 dark:text-slate-50
										md:text-[12px]
									"
								>
									Only send on Base
								</span>
							</div>
						</div>

						{/* Intro text */}
						<p
							className="
								text-[11px] text-slate-500 dark:text-slate-400
								mb-3 leading-relaxed
								md:text-[12px] md:leading-normal md:mb-4
							"
						>
							Show your Beamio address or QR code to receive USDC on Base. This wallet is
							self-custodial – funds go directly to you.
						</p>

						{/* QR + address card */}
						<div
							className="
								mb-4 rounded-3xl
								border border-slate-200 dark:border-slate-700
								bg-slate-50 dark:bg-slate-900/40
								px-4 py-4 flex flex-col items-center
								md:px-6 md:py-6
							"
						>
							{/* Beamio @account */}
							<div className="text-center mb-2">
								<p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
									Beamio
								</p>

								<p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
									@{account}
								</p>
							</div>

							{/* QR Code */}
							<div
							className="
								w-40 h-40 rounded-2xl
								bg-slate-200 dark:bg-slate-700
								flex items-center justify-center mb-1
								md:w-48 md:h-48 md:rounded-3xl
							"
							>
							<QRCodeCanvas
								value={walletAddress}
								size={160}
								level="H"
								includeMargin
								bgColor="transparent"
								fgColor="#000000"
								imageSettings={{
									src: bIcon,
									height: 40,
									width: 40,
									excavate: true,
								}}
								className="rounded-lg inline-block"
							/>

							</div>
							{/* Beamio @account - horizontal */}
							<div className="flex items-center justify-center mt-0.5 mb-6">
							
								<span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
									{fmtAddr(walletAddress)}
								</span>
							</div>

							{/* Address */}
							<div className="w-full mb-2 md:mb-3">
								<span
								className="
									block text-[10px]
									text-slate-500 dark:text-slate-400
									mb-1 md:text-[11px]
								"
								>
									Your Beamio address
								</span>

								<div
								className="
									w-full flex items-center justify-between
									rounded-2xl
									border border-slate-200 dark:border-slate-700
									bg-white dark:bg-slate-900
									px-3 py-2
									md:px-4 md:py-3
								"
								>
								<span
									className="
									text-[11px] md:text-[12px]
									font-mono
									text-slate-900 dark:text-slate-50
									truncate
									"
								>
									{walletAddress}
								</span>

								<CopyButton value={walletAddress} />
								</div>
							</div>

							{/* Small hint */}
							<p
								className="
								mt-3 md:mt-4
								text-[10px] md:text-[11px]
								text-slate-500 dark:text-slate-400
								text-center leading-relaxed
								"
							>
								Only send <span className="font-medium">USDC on Base</span> to this address.
								Sending any other assets may result in loss of funds.
							</p>
						</div>

						{/* 2) Receive by redeeming a Cashcode */}
							<section className="rounded-3xl bg-white border border-slate-100 shadow-sm px-4 pt-4 pb-5">
								<div className="flex items-center justify-between mb-3">
									<div className="flex flex-col">
									<span className="text-[11px] text-slate-500 dark:text-slate-400
									mb-3 leading-relaxed
									md:text-[12px] md:leading-normal md:mb-4">Redeem a Cashcode</span>
									<span className="text-[10px] text-slate-400">One-time digital check into this wallet</span>
									</div>
								</div>

								{/* Cashcode input */}
								{/* Cashcode */}
									<div className="flex items-center rounded-2xl bg-slate-50 border border-slate-200 px-4 h-12">
									<input
										value={redeemCode}
										className="
										flex-1
										bg-transparent
										text-xs md:text-sm
										font-mono
										text-slate-900
										outline-none
										placeholder:text-slate-400
										text-center
										px-2                 /* 内部左右留一点空 */
										"
										placeholder="Paste or type the Cashcode (e.g. 24J2RgQYpiH1iXSlhOKYNV)"
										onChange={e => {
											setProcessError('')
											setRedeemCode(e.target.value)
											}}
									/>

									<button
										onClick={handlePaste}
										className="
										text-[11px] font-medium
										text-blue-600 hover:text-blue-700
										shrink-0
										ml-2              /* 和输入框拉开一点距离 */
										text-right
										"
									>
										{redeemCode ? 'Delete' : 'Paste'}
									</button>
									</div>
								{/* Security code input (optional) */}
								<section className="space-y-1">
									<div className="flex items-center justify-between">
										<label className="text-[11px] text-slate-500 dark:text-slate-400
									mb-3 leading-relaxed
									md:text-[12px] md:leading-normal md:mb-4">
											Security code (optional)
										</label>
										<span className="text-[11px] text-slate-400">
											6 digits (3-3)
										</span>
									</div>
									{/* Security code */}
									<div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 h-12">
									<input
										value={isFocused ? securityCodeDigits : formatSecurityCode(securityCodeDigits)}
										onChange={(e) => {
										setProcessError('')
										const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6)
										setSecurityCodeDigits(onlyDigits)
										}}
										onFocus={() => setIsFocused(true)}
										onBlur={() => setIsFocused(false)}
										className="
										w-full
										bg-transparent
										text-base
										tracking-[0.35em]
										text-center
										outline-none
										text-slate-900
										font-mono
										px-2
										"
										placeholder="•••-•••"
									/>
									</div>
									<p className="text-[11px] text-slate-500">
										Only needed if the sender told you there is a Security code (e.g. 123-456). If you don&apos;t have one, leave this blank and try with just the Cashcode.
									</p>
								</section>

								{/* Helper copy */}
								<p className="text-[11px] text-slate-500 leading-snug mt-2">
									Cashcodes are one-time digital checks. To redeem, paste your Cashcode and, if the creator set one, enter the 3-3 security code. If there is no security code for this Cashcode, you can leave those fields empty. When you redeem, the USDC that was locked in the Cashcode moves into this wallet. The Beamio service fee (0.8%, min 0.02 USDC, max 2 USDC) was already paid by the person who created the Cashcode, so you receive the full amount.
								</p>

															{/* 错误提示条 */}
							{processError && (
								<div className="mb-4 px-3 py-2 text-left">
									<p className="text-red-700 text-sm leading-relaxed">
										{processError}
									</p>
								</div>
							)}


								{/* Redeem button */}
								<AppButton
									fullWidth
									onClick={tryRedeem}
									disabled={!!processError}
									loading={processing}
								>
									Redeem Cashcode
								</AppButton>
							
							</section>

						{/* Safety / info card */}
						<div
							className="
								mt-auto rounded-2xl
								border border-emerald-100 dark:border-emerald-500/40
								bg-emerald-50 dark:bg-emerald-900/30 mt-5
								px-3 py-2 md:px-4 md:py-3
								text-[10px] md:text-[11px]
								text-emerald-700 dark:text-emerald-200
							"
						>
							<p className="font-medium mb-1 md:mb-2">
								Beamio never takes custody of your funds.
							</p>
							<p>
								Payments go directly from other wallets to your Beamio wallet on Base. You keep
								full control of your keys.
							</p>
						</div>
					</div>
				)
			}
			{/* Content wrapper */}
			
		</div>

	);
}
