import React, {useRef, useState, useEffect, useMemo} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
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
import { X, Check, Plus, Camera, ArrowRight, ArrowLeft, Wallet, CreditCard, Zap, Fuel, XCircle } from "lucide-react"
import NetworkFeeGas from '../components/networkFee'
import ShowTotal from '../components/ShowTotal_send'
import { fiatPrefix, formatAmount } from '@/services/currency'
import { emitReactionAsNewMessage, sendMessage, initMessage, getRandomNodes} from '@/services/chat'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {OverlayPortal} from '@/components/OverlayPortal/OverlayPortal'
import { ethers } from 'ethers'
import { beamioApiBase, signAAtoEOA_USDC_with_BeamioContainerMainRelayed } from '@/services/AAaccount'
import { getAAAccount, getBUnitBalanceFromConetRpc } from '@/services/BeamioCard'
import { baseEndpoint } from '@/utils/constants'
import contracts from '@/utils/contracts'



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

const retryRpcCall = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T> => {
	let lastErr: unknown
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn()
		} catch (e) {
			lastErr = e
			if (i < retries) await new Promise((r) => setTimeout(r, 800))
		}
	}
	throw lastErr
}

const PAY_RECENT_KEY = 'beamio_pay_recent'
const PAY_RECENT_MAX = 8

function loadRecentRecipients(): searchResult[] {
	try {
		const raw = localStorage.getItem(PAY_RECENT_KEY)
		if (!raw) return []
		const arr = JSON.parse(raw) as searchResult[]
		return Array.isArray(arr) ? arr.slice(0, PAY_RECENT_MAX) : []
	} catch {
		return []
	}
}

function saveRecentRecipients(items: searchResult[]) {
	try {
		localStorage.setItem(PAY_RECENT_KEY, JSON.stringify(items.slice(0, PAY_RECENT_MAX)))
	} catch {}
}

export type PayScreenMode = 'eoa-pay' | 'aa-eoa-transfer'

const unknowAcc = (address: string): searchResult => ({
	address,
	created_at: 0,
	first_name: '',
	last_name: '',
	follow_count: '',
	follower_count: '',
	username: 'Unknow',
	image: '',
})

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
	/** 扫码 beamio URL 中 wallet= 指定的收款地址，优先于 beamioer.address */
	preferredToAddress?: string
	/** 从 Smart Account 进入时为 aa-eoa-transfer（AA 与 EOA 互转）；否则为 eoa-pay（普通付款） */
	mode?: PayScreenMode
	/** AA 账户 USDC 余额（aa-eoa-transfer 且 aa-to-eoa 时用于 MAX / 余额校验） */
	aaAccountUsdcBalance?: string | number
	/** 挂载时自动聚焦金额输入框（如从扫码地址进入） */
	focusAmountOnMount?: boolean
	/** B-Unit 不足时点击「Go to Fuel Center」的回调，用于跳转显示 Fuel Center 供用户 topup */
	onShowFuelCenter?: () => void
}

export default function PayScreen ({close, beamioer, preferredToAddress, mode = 'eoa-pay', aaAccountUsdcBalance, focusAmountOnMount, onShowFuelCenter}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const { usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles, allNodes, setProfiles, setHistoryPayData, historyPayData, setScanData, setScanIntent, setVoucherPayAmount, setVoucherPayToAA, setVoucherPayFromScan } = useDaemonContext()
	const navigate = useNavigate()
	const isAaEoaTransfer = mode === 'aa-eoa-transfer'
	const [transferDirection, setTransferDirection] = useState<'eoa-to-aa' | 'aa-to-eoa'>('aa-to-eoa')
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)
	const [successHash, setSuccessHash] = useState("")
	const [cardCreate, setCardCreate] = useState(false)
	const [cardTitle, setCardTitle] = useState("Your dynamic text goes here")
	const [cardDetail, setCardDetail] = useState("Write some detail…")
	const [currentCurrency, setCurrentCurrency] = useState<ICurrency>('USD')
	const [showGiftEnvelope, setShowGiftEnvelope] = useState(false)
	const [showGiftImageError, setShowGiftImageError] = useState(false)
	const [uploadingIPFS, setUploadingIPFS] = useState(false)
	const [addedNote, setAddedNote] = useState("")
	const [showToError, setShowToError] = useState(false)
	const [recentRecipients, setRecentRecipients] = useState<searchResult[]>(() => loadRecentRecipients())
	/** 受益方为 AA 时 true，用于显示 Smart Routing 胶囊并走 Smart Routing 支付 */
	const [isPayeeAA, setIsPayeeAA] = useState<boolean | null>(null)
	/** B-Unit 不足预检失败时的错误信息 */
	const [bunitError, setBunitError] = useState<string | null>(null)

	const selectItem = (selected: searchResult) => {
		setItem(selected)
		// 加入最近选择列表（去重，新选中的放最前）
		setRecentRecipients((prev) => {
			const next = [selected, ...prev.filter((p) => p.address?.toLowerCase() !== selected.address?.toLowerCase())]
			saveRecentRecipients(next)
			return next
		})
	}

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		if (currency === 'USDC') return 1
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1
		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}

	function usdcToCurrencyAmount(usdc: number, c: ICurrency) {
		if (c === 'USDC') return usdc
		const rate = fxRateUSDCToCurrency(c)
		return usdc * rate
	}

	/** 将所选 currency 的金额按即时汇率换算为 USDC */
	function currencyAmountToUSDC(amountInCurrency: number, c: ICurrency): number {
		if (c === 'USDC') return amountInCurrency
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
			if (preferredToAddress && ethers.isAddress(preferredToAddress)) {
				setItem({ ...beamioer, address: preferredToAddress })
			} else {
				setItem(beamioer)
			}
		}
	}, [beamioer, preferredToAddress])

	// 受益方为 AA 时设置 isPayeeAA，用于显示 Smart Routing 胶囊（仅 eoa-pay 模式）
	useEffect(() => {
		if (isAaEoaTransfer || !item?.address || !ethers.isAddress(item.address)) {
			setIsPayeeAA(null)
			return
		}
		let cancelled = false
		setIsPayeeAA(null)
		const aaFactory = new ethers.Contract(
			contracts.BeamioAAAcountFactory.address,
			contracts.BeamioAAAcountFactory.abi,
			baseEndpoint
		)
		retryRpcCall(() => aaFactory.isBeamioAccount(item.address))
			.then((v) => { if (!cancelled) setIsPayeeAA(!!v) })
			.catch(() => { if (!cancelled) setIsPayeeAA(false) })
		return () => { cancelled = true }
	}, [isAaEoaTransfer, item?.address])

	useEffect(() => {
		if (focusAmountOnMount) {
			const t = setTimeout(() => setFocusAmount(true), 300)
			return () => clearTimeout(t)
		}
	}, [focusAmountOnMount])

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
		const prefix = currentCurrency === 'USDC' ? 'USDC ' : (fiatPrefix(currentCurrency) + ' ')
		return prefix + curr
	}, [sendAmount, currentCurrency, currencyData])

	/** aa-to-eoa 输入金额后，检测 AA 余额是否足够（sendAmount 已是 USDC） */
	const insufficientAaBalance = useMemo(() => {
		if (!isAaEoaTransfer || transferDirection !== 'aa-to-eoa' || !sendAmount) return false
		const usdcAmt = Number(sendAmount)
		if (!(usdcAmt > 0 && isFinite(usdcAmt))) return false
		const aaBal = Number(aaAccountUsdcBalance ?? 0)
		return usdcAmt > aaBal
	}, [isAaEoaTransfer, transferDirection, sendAmount, aaAccountUsdcBalance])




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


	/** 402 签字确认：用户按下后才 ethers 签字并送往服务器；重试时重新签字 */
	const signRequest = async () => {
		if (!message) return
		setProcessing(true)
		setSendError('') // 重试时清除旧错误，确保重新获取 ethers 签字
		try {
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
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()

			if (!secondResponse.ok) {
				setProcessing(false)
				return setSendError((body as { error?: string })?.error ?? 'RPC Error!')
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

		const currencyAmount = currentCurrency === 'USDC' ? sendAmount : formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency)
		const index = profile.chats.findIndex(n => n.address === chatData.address)
		if (index > -1) {
			profile.chats.splice(index, 1)
		}
		
		const messageCard = emitReactionAsNewMessage(Number(currencyAmount), currentCurrency, note, Number(sendAmount), '')
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

		// AA→EOA：AmountCurrency 输出为 USDC（outputNativeCurrency 默认 false），直接使用 sendAmount 作为 USDC；currency/currencyAmount 用于 API 的 afterNote 展示
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
			// sendAmount 已是 USDC（AmountCurrency 内部换算后输出）；currencyAmount 与 EOA→AA 一致：USDC 时用原值，否则按汇率换算后格式化
			const usdcAmountStr = amount > 0 ? amount.toFixed(6) : '0'
			const currencyAmountDisplay = currentCurrency === 'USDC' ? sendAmount : formatAmount(usdcToCurrencyAmount(amount, currentCurrency), currentCurrency)
			const aaBal = Number(aaAccountUsdcBalance ?? 0)
			if (amount > aaBal) {
				setSendError('Insufficient balance')
				return
			}
			setProcessing(true)
			// 发送前必须用链上查到的 AA 地址，不信任 profile.aaAccount（可能为旧缓存或误设为 EOA）
			let aaAccount: string
			try {
				const fromChain = await getAAAccount(profile)
				if (!fromChain || !fromChain.startsWith('0x')) {
					setSendError('No Express Pay found. Please create or link a Express Pay first.')
					setProcessing(false)
					return
				}
				if (myAddress && fromChain.toLowerCase() === myAddress.toLowerCase()) {
					setSendError('Express Pay address cannot be the same as your EOA. Please create or link a Express Pay first.')
					setProcessing(false)
					return
				}
				aaAccount = fromChain
			} catch (e: any) {
				setSendError(e?.message ?? 'Failed to get Express Pay address')
				setProcessing(false)
				return
			}
			// B-Unit 预检（客户端直接从 CoNET 查余额）：AA owner 需 >= 2 B-Units
			try {
				const aaRead = new ethers.Contract(aaAccount, ['function owner() view returns (address)'], baseEndpoint)
				const owner = await aaRead.owner()
				const payerEOA = owner && owner !== ethers.ZeroAddress ? ethers.getAddress(owner) : null
				if (payerEOA) {
					const { total } = await getBUnitBalanceFromConetRpc(payerEOA)
					if (total < 2) {
						setBunitError(`Insufficient B-Units: payer needs 2 B-Units for transfer fee (balance: ${total} B-Units)`)
						setProcessing(false)
						return
					}
				}
			} catch (e) {
				setSendError((e as Error)?.message ?? 'B-Unit balance check failed')
				setProcessing(false)
				return
			}
			try {
				// 签字送出前检查 currency，避免记账时遗失
				if (!currentCurrency || !String(currentCurrency).trim()) {
					setSendError('Currency is required for accounting')
					setProcessing(false)
					return
				}
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
			const aaBal = Number(aaAccountUsdcBalance ?? 0)
			if (amount > aaBal) return // AA 转出，用 AA 余额
		}
		} else {
			// 普通付款：必须有选中的收款人
			if (!item || !myAddress) {
				return setShowToError(true)
			}
			toAddress = item.address
			if (amount <= 0) return
			// 受益方为 AA 时走 Smart Routing（会校验 AA+EOA 余额），否则需 EOA 余额充足
			if (!isPayeeAA && amount > usdcbalance) return

			// 受益方为 AA 时交由 Smart Routing Analysis 处理（isPayeeAA 已预检则直接跳转，否则 RPC 校验）
			if (toAddress && ethers.isAddress(toAddress) && setScanData && setScanIntent && setVoucherPayAmount && setVoucherPayToAA && setVoucherPayFromScan) {
				const doRedirectToSmartRouting = () => {
					// 传入原始币种金额，USDC 换算由 Smart Routing Analysis 内部处理；避免 JPY 1 等小额换算成 USDC 后截断为 0
					const nativeAmount = currentCurrency === 'USDC' ? sendAmount : formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency)
					const paymentUrl = `https://beamio.app/Vouchers?Amount=${encodeURIComponent(nativeAmount)}&currency=${encodeURIComponent(currentCurrency)}&acceptTokens=USDC&to=${encodeURIComponent(toAddress)}`
					setScanData(paymentUrl)
					setScanIntent('payBill')
					setVoucherPayAmount(nativeAmount)
					setVoucherPayToAA(toAddress)
					setVoucherPayFromScan(true)
					close('')
					// 通过 navigation state 传递 payload，确保 History 挂载时金额等数据可用（避免 context 更新时序问题）
					navigate('/History', { state: { smartRoutingPayload: { paymentUrl, amount: nativeAmount, currency: currentCurrency, toAddress } } })
				}
				if (isPayeeAA) {
					doRedirectToSmartRouting()
					return
				}
				setProcessing(true)
				try {
					const aaFactory = new ethers.Contract(
						contracts.BeamioAAAcountFactory.address,
						contracts.BeamioAAAcountFactory.abi,
						baseEndpoint
					)
					const payeeIsAA = await retryRpcCall(() => aaFactory.isBeamioAccount(toAddress))
					if (payeeIsAA) {
						doRedirectToSmartRouting()
						return
					}
				} catch (e) {
					console.warn('PayScreen: isBeamioAccount check failed, fallback to default flow', e)
				} finally {
					setProcessing(false)
				}
			}
		}
		// B-Unit 预检（客户端直接从 CoNET 查余额）：EOA 转账需 >= 2 B-Units
		if (myAddress && ethers.isAddress(myAddress)) {
			try {
				const { total } = await getBUnitBalanceFromConetRpc(myAddress)
				if (total < 2) {
					setBunitError(`Insufficient B-Units: payer needs 2 B-Units for transfer fee (balance: ${total} B-Units)`)
					return
				}
			} catch (e) {
				setSendError((e as Error)?.message ?? 'B-Unit balance check failed')
				return
			}
		}
		const bo = beamio

		const currencyAmount = currentCurrency === 'USDC' ? sendAmount : formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency)
		if (!currentCurrency || !String(currentCurrency).trim()) {
			setSendError('Currency is required for accounting')
			return
		}
		// 协议：使用显式参数 currency/currencyAmount/usdcAmount，不再使用 payMe JSON
		let sendNote = note
		if (addedNote) {
			sendNote += (sendNote ? '\r\n' : '') + addedNote
		}
		const params = new URLSearchParams({
			amount: sendAmount,
			usdcAmount: sendAmount,
			currency: currentCurrency,
			currencyAmount,
			toAddress,
			note: sendNote.trim(),
			...(isAaEoaTransfer && transferDirection === 'eoa-to-aa' && { isInternalTransfer: 'true' }),
		}).toString()
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
	<div className="relative">
		{/* 顶部右侧：fixed 定位，始终距视口顶部 0.5rem，不受 search/avatar 切换影响 */}
		<button
			type="button"
			onClick={() => close('/')}
			className="
				fixed top-2 right-4 z-[9999]
				w-10 h-10 rounded-full
				bg-slate-100 dark:bg-slate-800
				flex items-center justify-center
				hover:bg-slate-200 dark:hover:bg-slate-700
				active:scale-95
				transition-colors
			"
			aria-label="Close"
		>
			<X className="w-5 h-5 text-slate-600 dark:text-slate-300" strokeWidth={2.5} />
		</button>
		{/* 内容区：左右对称 padding，居中显示 */}
		<div className="w-full mt-8 mb-16 px-4 sm:px-6">
		{/* ✅ 原 CardContent 的 padding 交给这里 */}
		<div className="">
			{successHash ? (
			<>
				{/* 原来 CardContent className="p-4 space-y-4" */}
				{/* 现在外层已经有 p-2 / space-y-4，你要更松就改成 p-4 */}
				<Success messageData={message} />
			</>
			) : bunitError ? (
			<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center bg-transparent text-inherit">
				<XCircle className="w-14 h-14 text-amber-500 dark:text-amber-400 shrink-0" />
				<p className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100 text-center">Insufficient B-Units</p>
				<p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center break-words max-w-[320px]">{bunitError}</p>
				<div className="mt-6 w-full space-y-3 max-w-[280px]">
					{onShowFuelCenter && (
						<button
							type="button"
							onClick={() => {
								setBunitError(null)
								onShowFuelCenter()
							}}
							className="w-full py-3 px-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold text-sm hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors flex items-center justify-center gap-2"
						>
							<Fuel className="w-4 h-4" strokeWidth={2.5} />
							Go to Fuel Center
						</button>
					)}
					<button
						type="button"
						onClick={() => setBunitError(null)}
						className="w-full py-3 px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
					>
						Back
					</button>
				</div>
			</div>
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
						<>
						<section className="mt-16 mb-4">
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
							dropdownDownward
							/>
						</section>
						{/* 最近选择：本地存储记忆，点击选中 */}
						{recentRecipients.length > 0 && (
							<div className="mb-4 flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
								{recentRecipients.map((r) => (
									<button
										key={r.address}
										type="button"
										onClick={() => selectItem(r)}
										className="flex-shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
									>
										<div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center ring-2 ring-transparent hover:ring-blue-300">
											{r.image ? (
												<img src={r.image} alt={r.username} className="w-full h-full object-cover" />
											) : (
												<img src={getImg(r.username || r.address)} alt={r.username} className="w-full h-full object-cover" />
											)}
										</div>
										<span className="text-[11px] font-medium text-blue-600 truncate max-w-[56px]">
											@{(r as { username?: string; accountName?: string }).username || (r as { accountName?: string }).accountName || r.address?.slice(0, 6) || ''}
										</span>
									</button>
								))}
							</div>
						)}
						</>
						)}

						{item && !isAaEoaTransfer && (
							<div
								className="
									w-full
									flex justify-center
									pt-4
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
											mt-1
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
							<section className="input">
								<AmountCurrency
									amount={sendAmount}
									setAmount={setSendAmount}
									autoEntry={!!!item}
									readOnly={processing||!!message}
									showLimit={0}
									sendError={insufficientAaBalance ? 'Insufficient balance' : sendError}
									setSendError={setSendError}
									showMax={true}
									needBalance={true}
									focusSignal={focusAmount}
									currencyChange={val => setCurrentCurrency(val)}
									balanceOverride={isAaEoaTransfer && transferDirection === 'aa-to-eoa' ? aaAccountUsdcBalance : undefined}
								/>
							</section>

							{/* 受益方为 AA：显示紫色 Smart Routing 胶囊；否则显示 Paying from */}
							{isPayeeAA ? (
								<section className="mt-4 flex justify-center">
									<div className="inline-flex items-center gap-2 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700/60 px-4 py-2.5">
										<Zap size={18} className="text-violet-600 dark:text-violet-400 shrink-0" />
										<span className="font-semibold text-violet-700 dark:text-violet-300">Smart Routing Analysis</span>
									</div>
								</section>
							) : (
							<section className="mt-4 rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
								<div className="flex items-center justify-between px-4 pt-3 pb-2">
									<span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase">Paying from</span>
									{isAaEoaTransfer && (
										<button
											type="button"
											onClick={() => setTransferDirection(d => d === 'eoa-to-aa' ? 'aa-to-eoa' : 'eoa-to-aa')}
											className="text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
										>
											Change &gt;
										</button>
									)}
								</div>
								<div className="flex items-center justify-between px-4 pb-4">
									<div className="flex items-center gap-3 min-w-0">
										<div className="w-10 h-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
											<Wallet className="w-5 h-5 text-slate-600 dark:text-slate-300" strokeWidth={2.2} />
										</div>
										<div className="min-w-0">
											<div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
												{isAaEoaTransfer && transferDirection === 'aa-to-eoa' ? 'Express Pay' : 'Main Vault'}
											</div>
											<div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
												Secure • {isAaEoaTransfer && transferDirection === 'aa-to-eoa' ? 'AA' : 'EOA'}
											</div>
										</div>
									</div>
									<div className="text-right shrink-0 ml-4">
										<div className="font-semibold text-slate-900 dark:text-slate-100">
											{currentCurrency === 'USDC'
												? `${formatAmount(
														isAaEoaTransfer && transferDirection === 'aa-to-eoa'
															? Number(aaAccountUsdcBalance ?? 0)
															: Number(usdcbalance ?? 0),
														'USDC'
													)} USDC`
												: `${fiatPrefix(currentCurrency)} ${formatAmount(
														usdcToCurrencyAmount(
															isAaEoaTransfer && transferDirection === 'aa-to-eoa'
																? Number(aaAccountUsdcBalance ?? 0)
																: Number(usdcbalance ?? 0),
															currentCurrency
														),
														currentCurrency
													)}`}
										</div>
										{currentCurrency !== 'USDC' && (
											<div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
												≈ {formatAmount(
													isAaEoaTransfer && transferDirection === 'aa-to-eoa'
														? Number(aaAccountUsdcBalance ?? 0)
														: Number(usdcbalance ?? 0),
													'USDC'
												)} USDC
											</div>
										)}
									</div>
								</div>
							</section>
							)}
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
							<div className="relative flex items-center mt-6 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-slate-700 overflow-hidden">
								{!showGiftEnvelope && (
									<button
										type="button"
										onClick={() => setCardCreate(true)}
										className="shrink-0 w-12 h-12 flex items-center justify-center border-r border-slate-200 dark:border-slate-700"
										aria-label="Open camera"
									>
										<Camera
											className="w-6 h-6 text-slate-900/20 dark:text-slate-400/60 opacity-80"
											strokeWidth={2.2}
										/>
									</button>
								)}
								<input
									type="text"
									value={note.split('\r\n')[0]}
									onFocus={() => {
										if (note === defaultNodeText) setNote('')
									}}
									readOnly={!!message}
									placeholder="What's this for?"
									onChange={(e) => setNote(e.target.value.replace(/[\r\n]/g, ''))}
									onKeyDown={(e) => {
										if (e.key === 'Enter') e.preventDefault()
									}}
									className="flex-1 min-w-0 px-3 py-3 text-sm text-slate-900 dark:text-slate-100 bg-transparent border-0 outline-none placeholder:text-slate-500"
								/>
							</div>
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
							<AppButton
								fullWidth
								// size="sm"
								onClick={message ? signRequest : onPay}
								loading={processing}
								errorText={sendError}
							>
								{message
									? (sendError ? 'Retry' : 'Confirm & Sign')
									: isAaEoaTransfer && transferDirection === 'aa-to-eoa' && sendError
										? 'Retry'
										: 'Send'}
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
