import React, {useRef, useState, useEffect, useMemo} from "react"
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
import { X, Check, Plus } from "lucide-react"
import LockModeSegmented from '../PaymentLink/LockModeSegmented'
import NetworkFeeGas from '../components/networkFee'
import ShowTotal from '../components/ShowTotal_send'
import {CURRENCY_META, fiatPrefix} from '@/services/currency'
import { emitReactionAsNewMessage, sendMessage, initMessage, getRandomNode} from '@/services/chat'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {OverlayPortal} from '@/components/OverlayPortal/OverlayPortal'


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

type Props = {
	close: (path: string) => void
	beamioer?: searchResult
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

export default function PayScreen ({close, beamioer}: Props) {
	
	const [sendAmount, setSendAmount] = useState("")
	const [processing, setProcessing] = useState(false)
	const [amountError, setAmountError]  = useState(false)
	const [note, setNote] = useState("");
	const [defaultNodeText, setDefaultNodeText] = useState(defaultTextTemp)
	const [item, setItem] = useState<searchResult|null>(beamioer||null)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'ConformView'>('')
	const [focusAmount, setFocusAmount] = useState(false)
	const {usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles, allNodes, setProfiles, setCharts } = useDaemonContext()
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


	useEffect(() => {
		if (sendError||showToError) {
			setTimeout(() => {
				setSendError('')
				setShowToError(false)
			}, 3000)
		}
	}, [sendError, showToError])


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
		const data: IMessageData =messageData.data
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
							close('/')
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
		const node = getRandomNode(allNodes)
		if (!chatData||!node) return
		const chatDatas = profile?.chats || []
		profile.chats = chatDatas

		
		const index = profile.chats.findIndex(n => n.address === chatData.address)
		if (index > -1) {
			profile.chats.splice(index, 1)
		}
		const sendAmountText = lockMode === 'USDC_LOCKED' ? usdcAmount : currentCurrency
		const messageCard = emitReactionAsNewMessage(sendAmountText, lockMode === 'USDC_LOCKED' ? 'USDC' : currentCurrency, note, lockMode === 'USDC_LOCKED'? '': sendAmount)
		chatData.messages.push(messageCard)
		profile.chats.push(chatData)
		setProfiles(profiles)
		temp.profiles = profiles
		setCoNET_Data(temp)
		const cardText = JSON.stringify(messageCard)
		// setCharts(prof => [...prof, cardText])
		await Promise.all([
			storeSystemData(),
			sendMessage(chatData.chatData.publicArmored, cardText, profile.privateKeyArmor, node )
		])
	}

	const onPay = async () => {

		const amount = Number(sendAmount)
		if ( amount <= 0 || amount > usdcbalance) {
			return 
		}
		const temp = CoNET_Data
		if (!item || !beamio || !myAddress||!profiles?.length||!temp) {
			return setShowToError(true)
		}
		const bo = beamio
		const toAddress = item.address

		
		let data: payMe = {
			currency: lockMode === 'FIAT_LOCKED' ? currentCurrency : 'USDC',
			currencyAmount:  lockMode === 'FIAT_LOCKED' ? formatAmount(usdcToCurrencyAmount(Number(sendAmount), currentCurrency), currentCurrency) : sendAmount
		}



		let sendNote = note
		let _addnote = addedNote

		if (addedNote) {
			const tryAdd = JSON.parse(addedNote)
			const card = tryAdd.card
			const _data = {
				title: card.title,
				detail: card.detail,
				image: card.image,
				currency: lockMode=== 'USDC_LOCKED' ? 'USDC' : currentCurrency,
				currencyAmount: currencyAmountText
			}

			_addnote = JSON.stringify(_data)
		}

		if (_addnote) {
			sendNote += `\r\n${_addnote}`
		}

		sendNote += `\r\n${JSON.stringify(data)}`
		
		
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
			const data: IMessageData = {
				receive: {
					accountName: item.username,
					firstName: item.first_name,
					lastName: item.last_name,
					address: item.address,
					image: item.image
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
				amount: sendAmount
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
		if (!profiles) return
		setUploadingIPFS(true)
		const profile = profiles[0]
		const result = await postToIPFS(profile, val.bgBase64)
		setUploadingIPFS(false)
		if (!result) {
			setShowGiftImageError(true)
			return console.log (`tryPostToIPFS Error!`)
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

	}

	return (
	// ✅ 白底容器，不再 items-center（避免“卡片居中感”）
	<div className="">
		{/* ✅ 不再 justify-center，不包 Card */}
		<div className="mt-1 w-full">
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
						{!item && (
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

						{item && (
						<div
							className="
							w-full flex items-center
							px-3 py-2.5
							text-left
							rounded-2xl
							bg-sky-50
							hover:bg-sky-100
							active:scale-[0.99]
							transition
							relative
							"
							onClick={() => {}}
						>
							{!message && (
							<button
								type="button"
								aria-label="Close"
								onClick={(e) => {
								e.stopPropagation()
								setItem(null)
								}}
								className="
								absolute top-1.5 right-1.5
								h-7 w-7
								rounded-full
								bg-white/70
								backdrop-blur
								border border-sky-200/60
								text-slate-500
								flex items-center justify-center
								shadow-sm
								transition
								hover:bg-white
								hover:text-slate-700
								active:scale-90
								active:ring-4 active:ring-sky-200/50
								"
							>
								<span className="text-[16px] leading-none">×</span>
							</button>
							)}

							{item.image ? (
							<img
								src={item.image}
								alt={item.username}
								className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0"
							/>
							) : (
							<img
								src={getImg(item.username)}
								alt={item.username}
								className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0 bg-sky-200"
							/>
							)}

							<div className="flex-1 flex items-start justify-between gap-3 min-w-0 pr-7">
							<div className="flex flex-col min-w-0">
								<span className="text-[13px] font-medium text-slate-900 truncate">
								{displayName(item)}
								</span>

								<span className="text-[11px] text-slate-600 truncate">
								@{item.username} · {shortAddress(item.address)}
								</span>
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

						{showGiftEnvelope && (
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

						{!message && (
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

						<div className="mt-3 flex gap-3 w-full">
						{message && !processing && (
							<AppButton
							variant='secondary'
							fullWidth
							// 如果你已经加 size="sm" 了，这里也可以用
							// size="sm"
							onClick={() => {
								senMessage(null)
							}}
							>
							Cancel
							</AppButton>
						)}

						{!showGiftEnvelope && !message && (
							<AppButton
							fullWidth
							variant="secondary"
							// size="sm"
							onClick={() => {
								setCardCreate(true)
							}}
							>
							Add Photo
							</AppButton>
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

		{/* {cardCreate && (
				<div
				className="
					fixed inset-0 z-[999]
					bg-black/20
					backdrop-blur-[2px]
					flex
					px-4
					py-4
					"
				>
				<div
					className="
					w-full
					max-w-[520px]
					mx-auto
					flex
					flex-col
					h-full
					"
				>
					<div
					className="
						flex-1
						min-h-0
						overflow-hidden
						"
					>
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
				</div>
		)} */}
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
