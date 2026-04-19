import { useDaemonContext } from '@/providers/DaemonProvider'
import { useNavigate } from "react-router-dom"
import { useState, useRef, useEffect } from 'react'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import {ethers} from 'ethers'
import {redeemCodeHash} from '@/services/beamio'
import {AppButton} from '@/components/button/AppButton'
import RedeemSuccessScreen from './RedeemSuccessScreen'


type IGtCheckMemooo = {
	payHash: string
	from: string
	amount: bigint
	depositHash: string
	chianID: bigint
	erc3009Address: string
	decimals: bigint
	node: string
	createTimestamp: bigint
}
type Prof = {
	close: () => void
}

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://rpc1.conet.network'),
	
}

const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const showPaylinkSite = 'https://beamio.app'
const aptEndpoint = isLocal ? local : remote

// 0.8% fee, min 0.02, max 2 USDC
function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(2));
}
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const RedeemScreen = ({close}: Prof) => {
	const { profiles, secureCode, setSecureCode, beamio, ignoreUrl, setIgnoreUrl, redeemCode, setRedeemCode, myAddress } = useDaemonContext()

	const [hashError, setHashError] = useState(false) 
	const [note, setNote] = useState('')
	const [GenerateHash, setGenerateHash] = useState('')
	const [amount, setAmount] = useState('')
	const [createTimestamp, setCreateTimestamp] = useState(0)
	const [isFocused, setIsFocused] = useState(false)
	const [securityCodeDigits, setSecurityCodeDigits] = useState("")
	const [processError, setProcessError] = useState("")
	const [processing, setProcessing] = useState(false)
	const [successHash, setSuccessHash] = useState("")

	const formatSecurityCode = (value: string) => {
		// 只保留数字
		const digits = value.replace(/\D/g, "").slice(0, 6)

		// 分成两段
		const left = digits.slice(0, 3).padEnd(3, "•")
		const right = digits.slice(3, 6).padEnd(3, "•")

		return `${left}-${right}`
	}

	const getItem = async () => {
		try {
			const check: IGtCheckMemooo = await CoreContract.getCheckMemo(secureCode)

			if (!check.payHash || check.depositHash != ethers.ZeroHash) {
				setHashError(true)
				return
			}

			const _note = check.node.split('\r\n')[0]
			setNote(_note)
			setGenerateHash(check.payHash)
			const _amount = Number(ethers.formatUnits(check.amount, 6))
			const fee = calcFeeFromNumber(_amount)
			setAmount(formatMoney(_amount - fee))
			const _timestamp = Number(check.createTimestamp * BigInt(1000))
			setCreateTimestamp(_timestamp)
		} catch (ex: any) {
			setHashError(true)
			setSecureCode('')
		}
	}

	const tryRedeem = async() => {
		
		/**
		 * 		UI test
		 */

		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError(`Server error!`)
		// }, 2000)

		const hash = redeemCodeHash(redeemCode, securityCodeDigits)
		if (secureCode && hash !== secureCode) {
			setProcessing(false)
			setProcessError(`The entered Cashcode and Security Code could not be validated. Please try again.`)
			return 
		}
		setProcessing(true)

		const params = new URLSearchParams({secureCode: redeemCode, securityCodeDigits, address: myAddress }).toString()
		const endpointUrl = `${aptEndpoint}/api/redeemCheck?${params}`
		

		try {
			const res = await fetch(endpointUrl, {method: 'GET'})

			setProcessing(false)
			if (res.status !== 200) {
				return setProcessError(`Beamio RPC Error!`)
			}
			const result = await res.json()
			setSuccessHash(result.tx)

		} catch (ex) {
			setProcessing(false)
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}
	
	useEffect(() => {

		if (!secureCode) {
			return
		}

		getItem()

	}, [])

	useEffect(() => {

		if (!processError) {
			return
		}

		setTimeout(() => {
			setProcessError('')
		}, 3000)

	}, [processError])

	return (
		
		<div className="flex flex-col h-full pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
			{
				successHash ? (
					<RedeemSuccessScreen amount={amount} myAddress={myAddress} hash={successHash} note={note} viewClose={() => {
						close()
					}} />
				) : (
					<>
						<div className="flex-1 px-6 pt-8 pb-20 overflow-auto">
							<h1 className="text-center text-lg font-semibold text-slate-900 mb-1">
								Redeem Cashcode
							</h1>
							<p className="text-center text-[11px] text-slate-500 mb-6">
								Enter the Cashcode and, if needed, the Security code that was shared with you.
							</p>

							<div className="max-w-xl mx-auto space-y-6 text-sm">
								{
									GenerateHash && (
										<section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
											
											<div className="flex items-center justify-between">
												<div className="flex flex-col gap-0.5">
													<span className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
														You will receive
													</span>
													<span className="text-xl font-semibold text-slate-900">
														{amount}
													</span>
												</div>
												<div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
													<span>To: Your Beamio wallet</span>
													<span className="font-mono text-xs text-slate-700">
														{fmtAddr(myAddress)}
													</span>
												</div>
											</div>
											
											<div className="mt-2 space-y-1">
												<div className="flex items-center justify-between text-[11px] text-slate-500 uppercase tracking-wide">
													<span>Note for you</span>
													<span className="normal-case text-slate-400">Visible to you and the sender</span>
												</div>
												<div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
													{note}
												</div>
											</div>
											<p className="text-[11px] text-slate-500 pt-1">
												The person who created this Cashcode pays the Beamio and network fees. Their wallet address is not shown to you.
											</p>
											{/* Create Time */}
											<div className="text-[10px] sm:text-[11px] text-slate-400 text-right">
												Created: {new Date(createTimestamp).toLocaleString()}
											</div>
										</section>

									)
								}


								{/* Cashcode input */}
								<section className="space-y-1">
									<div className="flex items-center justify-between">
										<label className="text-sm font-medium text-slate-800">
											Cashcode
										</label>
										<span className="text-[11px] text-slate-400">
											Required · long code
										</span>
									</div>
									<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex justify-center">
										<input
											value={redeemCode}
											className="
												w-full
												bg-transparent
												text-xs md:text-sm
												font-mono
												text-slate-900
												outline-none
												placeholder:text-slate-400
												text-center     /* ⭐ 让文字居中 */
											"
											placeholder="Paste or type the Cashcode (e.g. 24J2RgQYpiH1iXSlhOKYNV)"
											onChange={e => {
												setProcessError('')
												setRedeemCode( e.target.value )
											}}
										/>
									</div>
									<p className="text-[11px] text-slate-500">
										This is the long code that identifies the Cashcode. If you opened this page from a Beamio link, this field may already be filled for you.
									</p>
								</section>

								{/* Security code input (optional) */}
								<section className="space-y-1">
									<div className="flex items-center justify-between">
										<label className="text-sm font-medium text-slate-800">
											Security code (optional)
										</label>
										<span className="text-[11px] text-slate-400">
											6 digits (3-3)
										</span>
									</div>
									<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex justify-center">
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
												bg-transparent
												text-base
												tracking-[0.35em]
												text-center
												outline-none
												text-slate-900
												font-mono
												
												mx-auto        /* ⭐ 水平自动外边距使其在父容器中居中 */
											"
											placeholder="•••-•••"
										/>
									</div>
									<p className="text-[11px] text-slate-500">
										Only needed if the sender told you there is a Security code (e.g. 123-456). If you don&apos;t have one, leave this blank and try with just the Cashcode.
									</p>
								</section>

								{/* Info */}
								<section className="space-y-1 text-[11px] text-slate-500">
									<p>
										When you redeem, <span className="font-mono font-bold">{amount}</span> will be released
										from the Cashcode smart contract to your Beamio wallet on Base.
										Beamio pays the network fee for this transaction.
									</p>
								</section>


							</div>

							<div className="px-6 pb-6 max-w-xl mx-auto w-full">

							{/* 错误提示条 */}
							{processError && (
								<div className="mb-4 px-3 py-2 text-left">
									<p className="text-red-700 text-sm leading-relaxed">
										{processError}
									</p>
								</div>
							)}

							{/* 按钮区：灵活容器 */}
							<div className="flex gap-3 w-full">

								{/* Cancel：只有在 !processing 时出现 */}
								{!processing && (
								<div className="flex-1">

									<AppButton
									variant='secondary'
									fullWidth
									onClick={() => {
										close()
									}}
									>
									Cancel
									</AppButton>
								</div>
								)}

								{/* Redeem：processing 时自动占据整行 */}
								<div className={`${processing ? 'flex-1' : 'flex-1'}`}>
								<AppButton
									fullWidth
									disabled={!!processError}
									loading={processing}
									onClick={() => tryRedeem()}
								>
									Redeem
								</AppButton>
								</div>

							</div>
						</div>
						</div>

						
					</>
				)
			}
			
		</div>
	)
}

export default RedeemScreen