import React, {useRef, useState, useEffect, useMemo} from "react"

import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData } from '@/services/beamio'
import { initMessage, getRandomNodes, sendMessage, createPaymentRequestCard } from '@/services/chat'
import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'
import AmountCurrency from '@/components/input/AmountCurrency'
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
import LockModeSegmented from './LockModeSegmented'
import FeeInline from './FeeInline'
import SuccessShow from './successShow'
import {Onetime_reuse_Drag} from '../../Pay/components/onetimeReuseSwitch'

function fiatPrefix(ccy: ICurrency) {
	if (ccy === "CAD") return "CA$"
	if (ccy === "USD") return "$"
	if (ccy === "EUR") return "€"
	if (ccy === "JPY") return "JP¥"
	if (ccy==='TWD') return "NT$"
	if (ccy==='CNY') return 'CN¥'
	if (ccy==='HKD') return 'HK$'
	if (ccy==='SGD') return 'SG$'
	
  return '$';
}

const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'
const showPaylinkSite = 'https://beamio.app'

const defaultTextTemp = `Sent with Beamio - no gas fees.`

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

const displayName = (item: searchResult) => {
	const lastname = (item.last_name ?? '').toString().split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '' : lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

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
	const [showToError, setShowToError] = useState(false)
	const { usdcbalance, beamio, setCurrencyData, currencyData, myAddress, profiles, setProfiles, allNodes } = useDaemonContext()
	const [sendError, setSendError] = useState("")
	const [message, senMessage] = useState<any>(null)

	const selectItem = (selected: searchResult) => {
		setItem(selected)
		setShowToError(false)
	}
	const [successUrl, setSuccessUrl] = useState("")
	const [lockMode, setLockMode] = useState<PaymentLinkLockMode>("FIAT_LOCKED")
	const [currency, setCurrency] = useState<ICurrency>('USD')
	const [payAmount, setPayAmount] = useState("")
	const [requestNet, setRequestNet] = useState("")
	const [processError, setProcessError] = useState("")
	/** 成功送出后用于 SuccessShow：保证显示的是「请求币种」金额与币种，不因 AmountCurrency 的 USDC 回传而错乱 */
	const [lastRequestAmount, setLastRequestAmount] = useState<number>(0)
	const [lastRequestCurrency, setLastRequestCurrency] = useState<ICurrency>('USD')
	const oneTimeMode = true
	const [linkTitle, setLinkTitle] = useState("")
	const [titleTouched, setTitleTouched] = useState(false)
	const titleError = titleTouched && linkTitle.trim().length === 0



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
		if (beamioer) {
			setItem(beamioer)
		}
	}, [beamioer])

	useEffect(() => {
		if (item) {
			setFocusAmount(true)
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

		if (!profiles?.length || !beamio) {
			return
		}
		if (!item) {
			setShowToError(true)
			return
		}
		setTitleTouched(true)

		if (linkTitle.trim().length === 0) {
			return // ❌ 阻止提交
		}
		const currency = beamio.currency
		// AmountCurrency 永远回传 USDC；FIAT 模式下需换算回「请求币种」金额，用于 payMe / 卡片 / 展示
		const usdcAmount = Number(sendAmount)
		if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
			return
		}
		const numberAmountInRequestCurrency =
			lockMode === 'USDC_LOCKED'
				? usdcAmount
				: usdcAmount * fxRateUSDCToCurrency(currency)
		if (numberAmountInRequestCurrency <= 0) {
			return
		}

		// Original currency + amount only; no conversion to USDC until receiver clicks Pay
		const showCurrencyNumber = lockMode === 'USDC_LOCKED' ? numberAmountInRequestCurrency.toFixed(4) : formatCurrencyAmount(numberAmountInRequestCurrency, currency)
		setProcessing(true)

		const currencyData = (lockMode === 'USDC_LOCKED' ? 'USDC' : currency) as ICurrency
		const profile: profile = profiles[0]
		const code = generateCODE('')

		const paymeObj: payMe = {
			currency: currencyData,
			currencyAmount: showCurrencyNumber,
			oneTimeMode: !oneTimeMode,
			title: linkTitle.trim(),
		}
		const showNote = note + `\r\n` + JSON.stringify(paymeObj)

		// For fiat requests pass 0; backend should use payMe in note for currency+amount. For USDC use amount in 6 decimals.
		const fixedAmount = lockMode === 'USDC_LOCKED' ? ethers.parseUnits(showCurrencyNumber, 6).toString() : '0'
		const params = new URLSearchParams({ amount: fixedAmount, code: code.hash, note: showNote, address: profile.keyID }).toString()
		const net = lockMode === 'USDC_LOCKED' ? numberAmountInRequestCurrency - calcFeeFromNumber(numberAmountInRequestCurrency) : numberAmountInRequestCurrency
		const showNetCurrency = lockMode === 'USDC_LOCKED' ? net.toFixed(4) : formatCurrencyAmount(numberAmountInRequestCurrency, currency)
		const showparams = new URLSearchParams({ code: code.code }).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		const showUrl = `${showPaylinkSite}?${showparams}`

		setPayAmount(`${fiatPrefix(currency)} ${showCurrencyNumber}`)
		setRequestNet(`${fiatPrefix(currency)} ${showNetCurrency}`)
		setLastRequestAmount(numberAmountInRequestCurrency)
		setLastRequestCurrency(currencyData)

		try {
			const chatData = await initMessage(profile, item)
			const nodes = getRandomNodes(allNodes || [], 2)
			if (!chatData?.chatData?.publicArmored || !nodes.length) {
				setProcessError('Could not create chat or get node')
				setProcessing(false)
				return
			}

			const paymentRequestMessage = createPaymentRequestCard({
				amount: numberAmountInRequestCurrency,
				currency: currencyData,
				title: linkTitle.trim(),
				usdcAmount: lockMode === 'USDC_LOCKED' ? numberAmountInRequestCurrency : undefined,
				requestUrl: showUrl,
				walletLabel: 'Main Wallet • EOA',
				memo: (note.trim() || linkTitle.trim()).slice(0, 200),
			})

			const chatList = profile.chats || []
			const idx = chatList.findIndex((c: chatData) => (c.address ?? '').toLowerCase() === (chatData.address ?? '').toLowerCase())
			if (idx >= 0) chatList.splice(idx, 1)
			chatData.messages = [...(chatData.messages || []), paymentRequestMessage]
			chatList.push(chatData)
			profile.chats = chatList
			setProfiles([...profiles])
			const temp = CoNET_Data
			if (temp) {
				temp.profiles = profiles
				setCoNET_Data(temp)
			}

			await storeSystemData()
			await sendMessage(chatData.chatData.publicArmored, JSON.stringify(paymentRequestMessage), profile.privateKeyArmor, nodes)

			setSuccessUrl(showUrl)
		} catch (e) {
			console.error('issueRequestLink error', e)
			setProcessError((e as Error)?.message || 'Failed to send request')
		} finally {
			setProcessing(false)
		}
	}

return (
  // ✅ 去掉外部卡片：不再 rounded / shadow / ring / overflow-hidden
  <div className="">
    <div className="">
      <div className="">
        {
          successUrl ? (
            <SuccessShow
              payAmount={payAmount || (lockMode === 'FIAT_LOCKED' ? `${fiatPrefix(currency)}${sendAmount || '0'}` : `${sendAmount || '0'} USDC`)}
              note={linkTitle.trim() || undefined}
              successUrl={successUrl}
              onReset={() => setSuccessUrl('')}
              lockMode={lockMode}
              requestNet={requestNet}
              currency={lastRequestCurrency || currency}
              creatorEstUsdcFromFiat={lockMode === 'USDC_LOCKED' ? sendAmount : undefined}
              sentViaMessage
              paymentRequestAmount={lastRequestAmount > 0 ? lastRequestAmount : Number(sendAmount) || 0}
            />
          ) : (
            // ✅ 原来靠 px-6 pt-4 pb-6 的间距，这里用 p-2 保持不贴边
            <div className="p-2 space-y-4 bg-white">
              <div>
                <div className="text-lg font-semibold">Create Payment Link</div>
              </div>

			  {/* 收款人：未选时显示检索，选中后显示用户卡片（与 PayScreen 一致） */}
			  {!item && (
				<section className="mb-4">
					<SearchInputWithDropdown
						showHistory={false}
						closeWindow={res => {
							if (typeof res !== 'string') {
								selectItem(res)
							}
						}}
						showError={showToError}
						showBackIcon={false}
						select={true}
					/>
				</section>
			  )}

			  {item && (
				<div className="mb-4 flex justify-center">
					<div className="inline-flex flex-col items-center select-none">
						<div className="relative">
							<div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
								{item.image ? (
									<img src={item.image} alt={item.username} className="w-full h-full object-cover" />
								) : (
									<img src={getImg(item.username)} alt={item.username} className="w-full h-full object-cover" />
								)}
							</div>
						</div>
						<div className="-mt-1 flex flex-col items-center">
							<div className="text-[18px] leading-[18px] font-semibold text-blue-600">
								@{item.username}
							</div>
							<div className="mt-0.5 text-[12px] leading-[13px] text-slate-500">
								{shortAddress(item.address)}
							</div>
						</div>
						<button
							type="button"
							onClick={() => setItem(null)}
							className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700 underline"
						>
							Change recipient
						</button>
					</div>
				</div>
			  )}

              <div className="mt-5 flex items-center gap-3">
                <LockModeSegmented
                  value={lockMode}
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
                  readOnly={processing}
                  showLimit={0}
                  setSendError={setSendError}
                  sendError={sendError}
                  showMax={false}
                  needBalance={false}
                  focusSignal={focusAmount}
                  currencyUSDC={lockMode === 'USDC_LOCKED'}
                />
              </section>

              {/* Payment Link Title */}
              <div className="space-y-1">
                <div className="text-[13px] font-semibold text-slate-500">
                  Title <span className="text-red-500">*</span>
                </div>

                <input
                  type="text"
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  onBlur={() => setTitleTouched(true)}
                  placeholder="e.g. Coffee, Dinner, Invoice #1024"
                  className={[
                    "w-full rounded-[18px] px-4 py-3 text-[15px]",
                    "bg-slate-50 placeholder-slate-400",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
                    "focus:outline-none transition",
                    titleError
                      ? "ring-2 ring-red-400 bg-red-50/40"
                      : "ring-1 ring-black/10 focus:ring-2 focus:ring-[rgba(0,0,255,0.25)]"
                  ].join(" ")}
                />

                {titleError && (
                  <div className="text-[12px] text-red-500 pl-1">
                    Title is required
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <div className="text-[13px] font-semibold text-slate-500">
                  Note (optional)
                </div>

                <textarea
					value={note}
					onFocus={() => {
						if (note === defaultNodeText) setNote("")
					}}
					readOnly={!!message}
					placeholder="What's this for?"
					onChange={e => setNote(e.target.value)}
					rows={2}
					className="
						w-full
						rounded-[18px]
						bg-slate-50
						ring-1 ring-black/10
						px-4 py-3
						text-[14px] text-slate-900
						placeholder-slate-400
						shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]
						focus:outline-none
						focus:ring-2 focus:ring-[rgba(0,0,255,0.25)]
						resize-none
						transition
					"
                />
              </div>

              {/* <Onetime_reuse_Drag
                value={oneTimeMode}
                onChange={setOneTimeMode}
              /> */}

              <div className="mt-3 flex gap-3 w-full">
                <AppButton
                  fullWidth
                  // 如果你已经加了 size="sm"，这里也可以顺便用：
                  // size="sm"
                  onClick={issueRequestLink}
                  loading={processing}
                  errorText={processError}
                >
                  Generate
                </AppButton>
              </div>
            </div>
          )
        }
      </div>
    </div>
  </div>
)
}
