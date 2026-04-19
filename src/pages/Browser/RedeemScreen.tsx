import { useDaemonContext } from '@/providers/DaemonProvider'
import { useNavigate } from "react-router-dom"
import { useState, useRef, useEffect } from 'react'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import {ethers} from 'ethers'
import {redeemCodeHash, searchUsername} from '@/services/beamio'

import {AppButton} from '@/components/button/AppButton'
import RedeemSuccessScreen from './RedeemSuccessScreen'
import Securitycode from '@/components/input/Securitycode'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import ShowCard from '@/components/card/ShowCard'
import {fiatPrefix, formatTimeDetail, statusStyleMap, formatAmount} from '@/services/currency'



type Prof = {
	close: () => void
}

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://rpc1.conet.network'),
	
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const isLocal = false
const remote = 'https://api.settleonbase.xyz'
const local = 'http://localhost:4088'
const showPaylinkSite = 'https://beamio.app'
const aptEndpoint = isLocal ? local : remote

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
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const RedeemScreen = ({close}: Prof) => {
	const { profiles, secureCode, setSecureCode, beamio, ignoreUrl, setIgnoreUrl, redeemCode, setRedeemCode, myAddress,setShowFooter } = useDaemonContext()

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
	const [fromBeamio, setFromBeamio] = useState<searchResult|null>(null)
	const [card, setCard] = useState<IImageCard|null>(null)
	const [showGiftCard, setShowGiftCard] = useState(false)
	const [title, setTitle] = useState('')

	const formatSecurityCode = (value: string) => {
		// 只保留数字
		const digits = value.replace(/\D/g, "").slice(0, 6)

		// 分成两段
		const left = digits.slice(0, 3).padEnd(3, "•")
		const right = digits.slice(3, 6).padEnd(3, "•")

		return `${left}-${right}`
	}

	const getBeo = async (address: string) => {

		const data = await searchUsername(address)||[]
		if (data?.results?.length) {
			setFromBeamio({...data.results[0]})
		}
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
					<img
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
					<span
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
					</span>
				</button>)
	}

	const getItem = async () => {
		try {
			const check: IGtCheckMemooo = await CoreContract.getCheckMemo(secureCode)

			if (!check.payHash || check.depositHash != ethers.ZeroHash || check.from === ethers.ZeroAddress) {
				setHashError(true)
				return
			}

			await getBeo(check.from)
			const _note = check.node.split('\r\n')
			
				
				

				//		try get currency data
			

			let card: IImageCard | undefined
			let payme: payMe | undefined

			const nodeEX = check?.node?.split("\r\n") || []
			let paymeData = nodeEX.length - 1


			try {
				if (paymeData > -1) {
					const cardData = JSON.parse(nodeEX[paymeData--])
					card = cardData?.card || cardData
				}
			} catch {
				paymeData++
			}
			
			try {
				if (paymeData > -1) payme = JSON.parse(nodeEX[paymeData--])
			} catch {
				paymeData++
			}
			if (payme?.title) {
				setTitle(payme.title)
			}
			setCard(card||null)

			setNote(_note[0])
			setGenerateHash(check.payHash)

			const _amount = Number(ethers.formatUnits(check.amount, 6))
			const fee = calcFeeFromNumber(_amount)
			setAmount(formatMoney(_amount-fee))
			const _timestamp = Number(check.createTimestamp * BigInt(1000))
			setCreateTimestamp(_timestamp)
			setShowFooter(false)
			
		} catch (ex: any) {
			setHashError(true)
			
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
		
		<div className="">
			{
				successHash ? (
					<RedeemSuccessScreen amount={amount} myAddress={myAddress} hash={successHash} note={note} viewClose={() => {
						close()
					}} />
				) : (
					<>
						<div className="">
							<h1 className="text-center text-lg font-semibold text-slate-900 mb-1">
								Cashcode
							</h1>
							<div className="p-3">
								
								{
									Number(amount) > 0 && (
										<div className="flex w-full items-end justify-center gap-1">
										{/* 金额：蓝色大字 */}
										<span className="text-[38px] font-extrabold leading-none text-[#2F63FF]">
										  {formatAmount(Number(amount), "USDC")}
										</span>
									  
										{/* USDC：灰色小字 */}
										<span className="pb-[1px] text-[11px] font-semibold text-slate-400 tracking-wide">
										  USDC
										</span>
									  </div>
									)
								}

								{
									title && (
										<div className="mt-4 pb-4">
											<div className="text-[22px] font-medium text-slate-900">
												{title}
											</div>
										</div>
									)
								}
									
								{
									note && 
										<div className="mt-4 pb-4">
											<div
												className="
												rounded-2xl
												bg-yellow-50/60
												backdrop-blur-sm
												ring-1 ring-yellow-200/40
												px-4 py-3
												"
											>
												<div className="flex items-start gap-2 text-[14px] leading-relaxed">
												<span className="shrink-0 text-yellow-700/60 font-medium">
													Note
												</span>

												<span className="text-slate-700 break-words">
													{note}
												</span>
												</div>
											</div>
										</div>
								}

							<div className=" overflow-hidden flex justify-center"> {/* mt-4 -> mt-3 */}
							{card && (
								<button
									type="button"
									onClick={() => {
										setShowGiftCard(true)
									}}
									className="
										group
										flex items-center justify-center
										p-2
										rounded-xl
										hover:bg-slate-100
										active:scale-95
										transition
									"
									aria-label="Open gift"
								>
									<img
										src={giftEnvelope}
										className="
											w-12   /* w-14 -> w-12 */
											block
											transition
											group-hover:opacity-90
											group-active:opacity-80
										"
										alt="Gift Envelope"
									/>
								</button>
							)}
						</div>
								<section className="space-y-1 mt-2">
									<div className="flex items-center justify-between">
										<label className="text-sm font-medium text-slate-800">
											Enter cashcode
										</label>
										
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
									
								</section>

								{/* Security code input (optional) */}
								<Securitycode securityCodeDigits={securityCodeDigits} setSecurityCodeDigits={setSecurityCodeDigits} />

								

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

							

							<div className="px-6 pb-6 max-w-xl mx-auto w-full">
							</div>
						</div>

						
					</>
				)
			}
			{showGiftCard && card &&(
				<ShowCard
					card={card}
					address={fromBeamio?.username||fromBeamio?.address||''}
					usdcAmount={amount}
					cancel={() => {
						setShowGiftCard(false)
					}}
				/>
			)}
		</div>
	)
}

export default RedeemScreen