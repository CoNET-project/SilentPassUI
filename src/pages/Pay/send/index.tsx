import React, {useRef, useState, useEffect, useMemo} from "react"
import { motion, AnimatePresence } from "framer-motion"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import { Card, CardContent } from "@/components/ui/card"
import {AuthorizationSign, getBalanceProcess, postToIPFS, storeSystemData} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import ConformView from './ConformView'
import base_ex from '@/components/assets/base-ex.svg'
import DiceBearCard, {ClosePayload} from '@/components/card/CreateCard'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import { X, Check, Plus, Camera, ArrowRight, ArrowLeft, Wallet, CreditCard } from "lucide-react"
import LockModeSegmented from '../PaymentLink/LockModeSegmented'
import NetworkFeeGas from '../components/networkFee'
import ShowTotal from '../components/ShowTotal_send'
import {CURRENCY_META, fiatPrefix} from '@/services/currency'
import { emitReactionAsNewMessage, sendMessage, initMessage, getRandomNodes} from '@/services/chat'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {OverlayPortal} from '@/components/OverlayPortal/OverlayPortal'
import { ethers } from 'ethers'
import { beamioApiBase, signAAtoEOA_USDC_with_BeamioContainerMainRelayed } from '@/services/AAaccount'
import { getAAAccount } from '@/services/BeamioCard'
import { baseEndpoint } from '@/utils/constants'



const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const ipfsEndpoint = `https://ipfs.conet.network/api/getFragment?hash=`

const defaultTextTemp = `Sent with Beamio - no gas fees.`

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

export type PayScreenMode = 'eoa-pay' | 'aa-eoa-transfer'

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
	/** 从 Smart Account 进入时为 aa-eoa-transfer（AA 与 EOA 互转）；否则为 eoa-pay（普通付款） */
	mode?: PayScreenMode
}

function formatAmount(v: number, c: ICurrency) {
	if (!isFinite(v)) return "0"

	const decimals =
		c === "TWD" || c === "JPY"
			? 0
			: c === "USDC"
			? 4
			: 2

	return v.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})
}

export default function PayScreen ({close, beamioer, mode = 'eoa-pay'}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles, allNodes, setProfiles, setHistoryPayData, historyPayData } = useDaemonContext()
	const isAaEoaTransfer = mode === 'aa-eoa-transfer'
	const [transferDirection, setTransferDirection] = useState<'eoa-to-aa' | 'aa-to-eoa'>('aa-to-eoa')
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successHash, setSuccessHash] = useState("")
	const [cardCreate, setCardCreate] = useState(false)
	const [cardTitle, setCardTitle] = useState("Your dynamic text goes here")
	const [cardDetail, setCardDetail] = useState("Write some detail…")
	const [currentCurrency, setCurrentCurrency] = useState<ICurrency>('USDC')
	const [showGiftEnvelope, setShowGiftEnvelope] = useState(false)
	const [showGiftImageError, setShowGiftImageError] = useState(false)
	const [uploadingIPFS, setUploadingIPFS] = useState(false)
	const [addedNote, setAddedNote] = useState("")
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [showToError, setShowToError] = useState(false)

	const selectItem = (item: searchResult) => {
		setItem(item)
	}

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}

	function usdcToCurrencyAmount(usdc: number, c: ICurrency) {
		const rate = fxRateUSDCToCurrency(c)
		return usdc * rate
	}

	/** 将所选 currency 的金额按即时汇率换算为 USDC（1 USDC = fxRateUSDCToCurrency(c) 的 currency） */
	function currencyAmountToUSDC(amountInCurrency: number, c: ICurrency): number {
		const rate = fxRateUSDCToCurrency(c)
		if (rate <= 0) return 0
		return amountInCurrency / rate
	}

	useEffect(() => {
		if (historyPayData) {
			setHistoryPayData(null)
		}
	}, [])

	useEffect(() => {
		if (sendError||showToError) {
			setTimeout(() => {
				setSendError('')
				setShowToError(false)
			}, 3000)
		}
	}, [sendError, showToError])

	useEffect(() => {
		if (beamioer) {
			setItem(beamioer)
		}
	}, [beamioer])

	// AA/EOA 模式：根据方向同步收款人 item（用于提交）；AA→EOA 固定为 myAddress
	useEffect(() => {
		if (!isAaEoaTransfer || !profiles?.[0]) return
		if (transferDirection === 'eoa-to-aa' && profiles[0].aaAccount) {
			setItem({
				address: profiles[0].aaAccount,
				username: 'Express Pay',
				first_name: '',
				last_name: JSON.stringify({}),
				image: '',
			} as searchResult)
			return
		}
		if (transferDirection === 'aa-to-eoa' && myAddress) {
			setItem({ address: myAddress, username: shortAddress(myAddress), first_name: '', last_name: JSON.stringify({}), image: '' } as searchResult)
		} else if (transferDirection === 'aa-to-eoa') {
			setItem(null)
		}
	}, [isAaEoaTransfer, transferDirection, profiles?.[0]?.aaAccount, myAddress])

	useEffect(() => {
		if (showGiftImageError) {
			setTimeout(() => {
				setShowGiftImageError(false)
			}, 3000)
		}
	}, [showGiftImageError])

	const usdcAmount = useMemo(() => {
		return formatAmount(Number(sendAmount), "USDC")
	}, [sendAmount])

	const currencyAmountText = useMemo(() => {
		const curr = formatAmount(
			usdcToCurrencyAmount(Number(sendAmount), currentCurrency),
			currentCurrency
		)
		return `${fiatPrefix(currentCurrency)} ${curr}`
	}, [sendAmount, currentCurrency, currencyData]) // ✅ 把 currencyData 纳入




	const Success = ({messageData}: {messageData: any}) => {
		const data: IMessageData = messageData.data
		return (
			<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center
							bg-transparent text-inherit">

				{/* 蓝色圆圈 ✔ */}
				<div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
					✓
				</div>

				{/* 成功文字 */}
				<div className="font-semibold text-slate-600 dark:text-slate-300 mb-2 mt-4">
					{/cashcode/i.test(messageData?.sginTatle) ? 'Cashcode Created' : 'Successfully sent' } 
				</div>

				{/* 金额 */}
				<div className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
					{data.amount} USDC
				</div>

				{/* 提示 */}
				<div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
					{/cashcode/i.test(messageData?.sginTatle) ? 'Share this Beamio Cashcode as a link, QR, or redeem code.' : 'It may take a few seconds to appear on-chain.' } 
				</div>

			
				

				{/* 按钮组 */}
				<div className="w-full space-y-3">

					{/* 完成按钮 */}
					<button
						className="w-full h-11 rounded-full
								bg-blue-600 text-white
								text-sm font-medium"
						onClick={() => {
							close('')
						}}
					>
						Done
					</button>

					{/* 查看交易按钮 */}
					<button
						className="
							w-full h-11 rounded-full
							bg-black/5 text-slate-700
							dark:bg-white/10 dark:text-slate-100
							text-sm
							flex items-center justify-center gap-2
						"
						onClick={() => {
							window.open(`https://basescan.org/tx/${successHash}`, '_blank', 'noopener,noreferrer')
						}}
						>
						<img
							src={base_ex}
							alt="Base Explorer"
							className="w-4 h-4 object-contain"
						/>
						<span>
							View transaction
						</span>
					</button>
				</div>
			</div>
		)
	}


	const signRequest = async () => {
			
		setProcessing(true)
		const pay = BigInt(Number(message.maxAmountRequired).toFixed(0))
		const paymentHeader = await AuthorizationSign(pay, message.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = message.data.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			
			
			if (!secondResponse.ok) {
				setProcessing(false)
				return setSendError('RPC Error!')
			}
			await sendMessageToClient()
			setProcessing(false)
			return setSuccessHash(body.USDC_tx)

		} catch (ex) {
			setProcessing(false)
			return setSendError('RPC Error!')
			
		}

	}

	const sendMessageToClient = async () => {
		const temp = CoNET_Data
		if (!item || !beamio || !myAddress||!profiles?.length||!temp) {
			return setShowToError(true)
		}
		const profile: profile = profiles[0]
		const chatData = await initMessage(profile, item)
		const nodes = getRandomNodes(allNodes, 2)
		if (!chatData||!nodes.length) return
		const chatDatas = profile?.chats || []
		profile.chats = chatDatas

		const currencyAmount = lockMode === 'FIAT_LOCKED' ? formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency) : sendAmount
		const index = profile.chats.findIndex(n => n.address === chatData.address)
		if (index > -1) {
			profile.chats.splice(index, 1)
		}
		
		const messageCard = emitReactionAsNewMessage(Number(currencyAmount), lockMode === 'USDC_LOCKED' ? 'USDC' : currentCurrency, note, Number(sendAmount), '')
		chatData.messages.push(messageCard)
		profile.chats.push(chatData)
		setProfiles(profiles)
		temp.profiles = profiles
		setCoNET_Data(temp)
		const cardText = JSON.stringify(messageCard)
		// setCharts(prof => [...prof, cardText])
		await Promise.all([
			storeSystemData(),
			sendMessage(chatData.chatData.publicArmored, cardText, profile.privateKeyArmor, nodes )
		])
	}

	const onPay = async () => {

		const amount = Number(sendAmount)
		const temp = CoNET_Data
		if (!beamio || !profiles?.length || !temp) {
			return setShowToError(true)
		}

		// AA→EOA：用户输入为 currentCurrency 金额，按即时汇率换算为 USDC 后打包；提交 containerPayload + currency + currencyAmount 到 /api/AAtoEOA
		if (isAaEoaTransfer && transferDirection === 'aa-to-eoa') {
			const toEOA = myAddress ?? ''
			if (!toEOA || amount <= 0) {
				setShowToError(true)
				return
			}
			const profile = profiles[0]
			if (!profile?.keyID || !profile?.privateKeyArmor) {
				setShowToError(true)
				return
			}
			const rate = fxRateUSDCToCurrency(currentCurrency)
			if (rate <= 0) {
				setSendError('Exchange rate not available for ' + currentCurrency)
				return
			}
			// 用户输入是 currentCurrency 的金额，换算为 USDC（6 位小数字符串）
			const usdcAmountNum = currencyAmountToUSDC(amount, currentCurrency)
			const usdcAmountStr = usdcAmountNum > 0 ? usdcAmountNum.toFixed(6) : '0'
			const currencyAmountDisplay = formatAmount(amount, currentCurrency)

			// 发送前必须用链上查到的 AA 地址，不信任 profile.aaAccount（可能为旧缓存或误设为 EOA）
			let aaAccount: string
			try {
				const fromChain = await getAAAccount(profile)
				if (!fromChain || !fromChain.startsWith('0x')) {
					setSendError('No Express Pay found. Please create or link a Express Pay first.')
					return
				}
				if (myAddress && fromChain.toLowerCase() === myAddress.toLowerCase()) {
					setSendError('Express Pay address cannot be the same as your EOA. Please create or link a Express Pay first.')
					return
				}
				aaAccount = fromChain
			} catch (e: any) {
				setSendError(e?.message ?? 'Failed to get Express Pay address')
				return
			}
			setProcessing(true)
			try {
				// 使用 containerMainRelayed 签名（绑定 to = owner EOA），金额为换算后的 USDC
				const profileWithAA = { ...profile, aaAccount }
				const containerPayload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayed(
					profileWithAA,
					usdcAmountStr,
					toEOA
				)
				// 提交 containerPayload + currency / currencyAmount 到 /api/AAtoEOA（服务端记账用）
				const url = `${beamioApiBase.replace(/\/$/, '')}/api/AAtoEOA`
				const res = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						containerPayload,
						currency: currentCurrency,
						currencyAmount: currencyAmountDisplay,
					}),
				})
				const result = await res.json().catch(() => ({})) as { success: boolean; USDC_tx?: string; error?: string }
				setProcessing(false)
				if (result.success && result.USDC_tx) {
					senMessage({
						data: {
							receive: { accountName: shortAddress(toEOA), firstName: '', lastName: JSON.stringify({}), address: toEOA, image: '' },
							sender: { accountName: beamio?.accountName ?? '', firstName: beamio?.firstName ?? '', lastName: beamio?.language ?? '', address: aaAccount, image: beamio?.image ?? '' },
							node: note,
							sginTatle: 'send',
							amount: usdcAmountStr,
							currencyAmount: currencyAmountDisplay,
						},
						reqUrl: `${beamioApiBase}/api/AAtoEOA`,
						amount: usdcAmountStr,
						currencyAmount: currencyAmountDisplay,
					})
					setSuccessHash(result.USDC_tx)
				} else {
					setSendError(result.error || 'AAtoEOA failed')
				}
			} catch (e: any) {
				setProcessing(false)
				setSendError(e?.message || 'AAtoEOA request failed')
			}
			return
		}

		// aa-eoa-transfer EOA→AA 或普通付款：按方向确定收款地址（To）与余额校验
		let toAddress: string
		if (isAaEoaTransfer) {
			if (transferDirection === 'eoa-to-aa') {
				toAddress = profiles[0]?.aaAccount ?? ''
				if (!toAddress) {
					setShowToError(true)
					return
				}
				if (amount <= 0 || amount > usdcbalance) return // EOA 转出，用 EOA 余额
			} else {
				toAddress = myAddress ?? ''
				if (!toAddress) { setShowToError(true); return }
				if (amount <= 0) return
			}
		} else {
			// 普通付款：必须有选中的收款人
			if (!item || !myAddress) {
				return setShowToError(true)
			}
			toAddress = item.address
			if (amount <= 0 || amount > usdcbalance) return
		}
		const bo = beamio

		const currencyAmount = lockMode === 'FIAT_LOCKED' ? formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency) : sendAmount
		let data1: payMe = {
			currency: lockMode === 'FIAT_LOCKED' ? currentCurrency : 'USDC',
			currencyAmount,
		}



		let sendNote = note
		let _addnote = addedNote

		if (addedNote) {
			const tryAdd = JSON.parse(addedNote)
			const card = tryAdd.card
			const _data: IImageCard = {
				title: card.title,
				detail: card.detail,
				image: card.image,
				currency: lockMode=== 'USDC_LOCKED' ? 'USDC' : currentCurrency,
				currencyAmount: currencyAmountText
			}

			_addnote = JSON.stringify(_data)
		}

		sendNote += `\r\n${JSON.stringify(data1)}`

		if (_addnote) {
			sendNote += `\r\n${_addnote}`
		}
		
		const params = new URLSearchParams({amount: sendAmount, toAddress: toAddress, note: sendNote }).toString()
		const path = `/api/BeamioTransfer?${params}`
		const requestEndpoint = aptEndpoint + path
		setProcessing(true)
		try {
					
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			setProcessing(false)

			if (response.status !== 402) {
				
				return setSendError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			// 收款人信息：以 toAddress 为准，保证与请求参数一致（EOA/AA 地址）
			const receiveName = item?.username ?? (toAddress === profiles?.[0]?.aaAccount ? 'Express Pay' : shortAddress(toAddress))
			const data: IMessageData = {
				receive: {
					accountName: receiveName,
					firstName: item?.first_name ?? '',
					lastName: item?.last_name ?? JSON.stringify({}),
					address: toAddress,
					image: item?.image ?? ''
				},
				sender: {
					accountName: bo.accountName||'',
					firstName: bo.firstName||'',
					lastName: bo.language,
					address: myAddress,
					image: bo.image
				},
				node: sendNote,
				sginTatle: 'send',
				reqUrl: requestEndpoint,
				amount: sendAmount,
				currencyAmount
			}
			
			MessageData.data = data
			senMessage(MessageData)
			setShowAlphaHowItWorks('ConformView')

			
		} catch (ex) {
			setProcessing(false)
			setSendError('RPC Error!')
		}

	}


	const tryPostToIPFS = async (val: ClosePayload) => {
		// ✅ 若 CreateCard 已即刻上传得到 imageUrl，直接使用
		if (val.imageUrl) {
			setCardTitle(val.title)
			setCardDetail(val.detail)
			setShowGiftEnvelope(true)
			setAddedNote(JSON.stringify({
				card: {
					title: val.title,
					detail: val.detail,
					image: val.imageUrl
				}
			}))
			return
		}

		if (!profiles) {
			console.error("tryPostToIPFS: profiles not available")
			return
		}
		
		if (!val.bgBase64) {
			console.error("tryPostToIPFS: bgBase64 is empty")
			setShowGiftImageError(true)
			return
		}

		setUploadingIPFS(true)
		try {
			const profile = profiles[0]
			if (!profile) {
				console.error("tryPostToIPFS: profile not found")
				setShowGiftImageError(true)
				setUploadingIPFS(false)
				return
			}

			const result = await postToIPFS(profile, val.bgBase64)
			setUploadingIPFS(false)
			
			if (!result) {
				console.error("tryPostToIPFS: postToIPFS returned null or undefined")
				setShowGiftImageError(true)
				return
			}

			setCardTitle(val.title)
			setCardDetail(val.detail)
			
			setShowGiftEnvelope(true)
			const addnote = {
				card: {
					title: val.title,
					detail: val.detail,
					image: `${ipfsEndpoint}${result}&t=${Date.now()}`
				}
			}
			setAddedNote(JSON.stringify(addnote))
		} catch (error) {
			console.error("tryPostToIPFS: Unexpected error", error)
			setUploadingIPFS(false)
			setShowGiftImageError(true)
		}
	}

	return (
	// ✅ 白底容器，不再 items-center（避免“卡片居中感”）
	<div className="">
		{/* ✅ 不再 justify-center，不包 Card */}
		<div className="w-full mt-8 mb-16">
		{/* ✅ 原 CardContent 的 padding 交给这里 */}
		<div className="">
			{successHash ? (
			<>
				{/* 原来 CardContent className="p-4 space-y-4" */}
				{/* 现在外层已经有 p-2 / space-y-4，你要更松就改成 p-4 */}
				<Success messageData={message} />
			</>
			) : (
			<>
				{/* ====== 下面这一整段你原来的 CardContent 里面内容，原封不动贴进来 ====== */}
				{
				(
					<>
					<div className={cardCreate ? "opacity-0 pointer-events-none select-none" : ""}>
						{/* AA ⇄ EOA 方向切换（仅 Smart Account 进入时显示） */}
						{isAaEoaTransfer && (
							<button
								type="button"
								onClick={() => setTransferDirection(d => d === 'eoa-to-aa' ? 'aa-to-eoa' : 'eoa-to-aa')}
								className="w-full flex items-center justify-center gap-2 py-3 px-4 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
							>
								<AnimatePresence mode="wait">
									{transferDirection === 'eoa-to-aa' ? (
										<motion.span
											key="eoa-aa"
											initial={{ opacity: 0, x: -8 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: 8 }}
											transition={{ duration: 0.2 }}
											className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200"
										>
											<span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
												<Wallet className="w-4 h-4 shrink-0" strokeWidth={2.2} />
												{shortAddress(myAddress)}
											</span>
											<ArrowRight className="w-4 h-4 shrink-0" />
											<span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
												<CreditCard className="w-4 h-4 shrink-0" strokeWidth={2.2} />
												{shortAddress(profiles[0].aaAccount)}
											</span>
										</motion.span>
									) : (
										<motion.span
											key="aa-eoa"
											initial={{ opacity: 0, x: 8 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -8 }}
											transition={{ duration: 0.2 }}
											className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200"
										>
											<span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
												<CreditCard className="w-4 h-4 shrink-0" strokeWidth={2.2} />
												{shortAddress(profiles[0].aaAccount)}
											</span>
											<ArrowRight className="w-4 h-4 shrink-0" />
											<span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
												<Wallet className="w-4 h-4 shrink-0" strokeWidth={2.2} />
												{shortAddress(myAddress)}
											</span>
										</motion.span>
									)}
								</AnimatePresence>
							</button>
						)}

						{/* 收款人：普通模式用 Search；AA→EOA 用地址输入；EOA→AA 用固定 “To: Smart Account” */}
						{/* {isAaEoaTransfer && transferDirection === 'eoa-to-aa' && (
							<div className="mb-4 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
								<span className="text-sm font-medium text-violet-800 dark:text-violet-200">To: Smart Account</span>
								{profiles?.[0]?.aaAccount && (
									<span className="text-xs font-mono text-violet-600 dark:text-violet-400">{shortAddress(profiles[0].aaAccount)}</span>
								)}
							</div>
						)}
						{isAaEoaTransfer && transferDirection === 'aa-to-eoa' && (
							<div className="mb-4 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
								<span className="text-sm font-medium text-violet-800 dark:text-violet-200">To: EOA</span>
								{myAddress && (
									<span className="text-xs font-mono text-violet-600 dark:text-violet-400">{shortAddress(myAddress)}</span>
								)}
							</div>
						)} */}
						{!isAaEoaTransfer && !item && (
						<section className="mb-4">
							<SearchInputWithDropdown
							showHistory={false}
							closeWindow={item => {
								if (typeof item !== 'string') {
									selectItem(item)
								}
							}}
							showError={showToError}
							showBackIcon={false}
							select={true}
							/>
						</section>
						)}

						{item && !isAaEoaTransfer && (
							<div
								className="
									w-full
									flex justify-center
								"
								onClick={() => {}}
							>
								{/* Centered content */}
								<div
									className="
									inline-flex flex-col items-center
									select-none
									"
								>
									{/* Avatar */}
									<div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center mt-4">
									{item.image ? (
										<img
										src={item.image}
										alt={item.username}
										className="w-full h-full object-cover"
										/>
									) : (
										<img
										src={getImg(item.username)}
										alt={item.username}
										className="w-full h-full object-cover"
										/>
									)}
									</div>

									{/* Text under avatar (shadow only) */}
									<div
										className="
											-mt-1
											flex flex-col items-center
											pointer-events-none
										"
									>
										{/* beamioTag */}
										<div
											className="
											text-[18px] leading-[18px]
											font-semibold
											text-blue-600
											
											"
										>
											@{item.username}
										</div>

										{/* wallet address */}
										<div
											className="
											mt-0.5
											text-[12px] leading-[13px]
											text-blue-600
											
											"
										>
											{shortAddress(item.address)}
										</div>
									</div>
								</div>
							</div>
						)}

						{!message && (
						<>
							<div className="mt-5 flex items-center gap-3">
								<LockModeSegmented
									value={lockMode}
									readonly={!!message}
									onChange={val => {
									setLockMode(val)
									}}
								/>
							</div>

							<section className="input">
								<AmountCurrency
									amount={sendAmount}
									setAmount={setSendAmount}
									autoEntry={!!!item}
									readOnly={processing||!!message}
									showLimit={0}
									sendError={sendError}
									setSendError={setSendError}
									showMax={true}
									needBalance={true}
									focusSignal={focusAmount}
									currencyChange={val => setCurrentCurrency(val)}
									currencyUSDC={lockMode === 'USDC_LOCKED'}
								/>
							</section>
						</>
						)}

						{message && (
						<ShowTotal
							usdcAmount={sendAmount}
							fiatCurrency={currentCurrency}
							fiatAmount={formatAmount(
							usdcToCurrencyAmount(Number(sendAmount), currentCurrency),
							currentCurrency
							)}
						/>
						)}

						{showGiftImageError && (
						<div className="flex justify-center">
							<p className="text-sm text-rose-600">
							An error occurred while uploading the image to IPFS. Please try again later.
							</p>
						</div>
						)}

						{uploadingIPFS && (
						<div className="flex justify-center">
							<p className="text-sm text-slate-600 flex items-center gap-1">
							Uploading image to IPFS, please wait
							<span className="inline-flex w-4">
								<span className="animate-dot">.</span>
								<span className="animate-dot delay-200">.</span>
								<span className="animate-dot delay-400">.</span>
							</span>
							</p>

							<style>{`
							.animate-dot { animation: blink 1.4s infinite both; }
							.delay-200 { animation-delay: 0.2s; }
							.delay-400 { animation-delay: 0.4s; }
							@keyframes blink {
								0% { opacity: 0.2; }
								20% { opacity: 1; }
								100% { opacity: 0.2; }
							}
							`}</style>
						</div>
						)}

						{showGiftEnvelope && !isAaEoaTransfer && (
						<div className="flex justify-center">
							<div className="relative w-fit">
							<img
								src={giftEnvelope}
								className="w-24 block"
								alt="Gift Envelope"
							/>

							{!message && (
								<button
								type="button"
								onClick={() => setShowGiftEnvelope(false)}
								className="
									absolute top-0 right-0 z-30
									translate-x-1/2 -translate-y-1/8
									w-7 h-7 rounded-full
									bg-white/10
									backdrop-blur-md
									border border-white/20
									shadow-[0_4px_10px_rgba(0,0,0,0.12)]
									hover:bg-white/20
									active:scale-95
									transition
									flex items-center justify-center
								"
								aria-label="Remove gift envelope"
								>
								<X className="w-4 h-4 text-black/30" />
								</button>
							)}
							</div>
						</div>
						)}

						{!message && !isAaEoaTransfer && (
						<textarea
							value={note.split('\r\n')[0]}
							onFocus={() => {
							if (note === defaultNodeText) setNote('')
							}}
							readOnly={!!message}
							placeholder="What's this for?"
							onChange={(e) => {
								setNote(e.target.value)
							}}
							rows={2}
							className="w-full rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 mt-6"
						/>
						)}

						{message && (
						<>
							{note && (
							<div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-[12px] text-yellow-900 space-y-1 mt-6">
								{note}
							</div>
							)}

							<NetworkFeeGas />
						</>
						)}

						<div className="mt-6 flex gap-3 w-full">
							

							{!showGiftEnvelope && !message && !isAaEoaTransfer && (
								<>
								{/* iOS glass camera button - 仅在 eoa-pay 模式显示 */}
								<button
									type="button"
									onClick={() => {
										setCardCreate(true)
									}}
									className="
										shrink-0
										w-12 h-12
										rounded-full
										flex items-center justify-center

										bg-white/30
										backdrop-blur-md

										shadow-[0_8px_20px_rgba(0,0,0,0.18)]
										ring-1 ring-white/30

										active:scale-95
										transition
										border border-white/50   /* ← 白色 1px 外框 */
									"
									aria-label="Open camera"
								>
									<Camera
										className="w-6 h-6 text-slate-900/20 opacity-80"
										strokeWidth={2.2}
									/>
								</button>
								</>
							)}

							<AppButton
								fullWidth
								// size="sm"
								onClick={message ? signRequest : onPay}
								loading={processing}
								errorText={sendError}
							>
								{message ? 'Confirm': 'Send'}
							</AppButton>
						</div>
					</div>
					</>
				)
				}
				{/* ====== 以上原内容结束 ====== */}
			</>
			)}
		</div>
		</div>

		
		<OverlayPortal open={cardCreate}>
			<div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]">
				<div className="absolute inset-0">
					<DiceBearCard
					onClose={val => {
						setCardCreate(false)
						if (val) tryPostToIPFS(val)
					}}
					initialTitle={cardTitle}
					initialDetail={cardDetail}
					usdcAmount={usdcAmount}
					currencyText={currencyAmountText}
					/>
				</div>
			</div>
      </OverlayPortal>
	</div>
	)
}
