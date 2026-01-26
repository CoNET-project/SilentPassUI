import React, { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { createPortal } from 'react-dom';
import { ethers } from "ethers"
import { beamioConet } from "@/utils/constants"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { getBalanceProcess, formatWithThousands, aesGcmDecrypt } from "@/services/beamio"
import RedeemScreen from '@/pages/Browser/RedeemScreen'
import {
  QrCode,
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  ScanLine,
  Landmark,
  Loader,
  CalendarCheck,
  Banknote,
  HelpCircle,Sparkles,
  Zap
} from "lucide-react"
import AccountBeo from "./AccountBea"
import { fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived, calcFeeFromNumber } from "@/services/currency"
import base_icon from '@/components/assets/base-logo.png'
import PayScreen from '@/pages/Pay/send/index'
import PaymentLink from '@/pages/Pay/PaymentLink/index'
import NavigateLeftButton from '@/components/navigate'
import Cashcode from '@/pages/Pay/Cashcode/index'
import BankingBridge from './components/BankingBridge'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import ActivePannel from "./components/activePannel";

type SectionTx = TransferHistork

const showPaylinkSite = "https://beamio.app"

const getBadgeClass = (type: HistoryFilter) => {
  switch (type) {
    case "sent":
      return "bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200"
    case "received":
      return "bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200"
    case "pending":
      return "bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200"
    case "completed":
      return "bg-sky-300/35 text-sky-800 dark:bg-sky-700/35 dark:text-sky-200"
    case "reject":
      return "bg-rose-300/35 text-rose-700 dark:bg-rose-700/35 dark:text-rose-200"
    case "paid":
      return "bg-fuchsia-300/35 text-fuchsia-800 dark:bg-fuchsia-700/35 dark:text-fuchsia-200"
    case "deposited":
      return "bg-indigo-300/35 text-indigo-800 dark:bg-indigo-700/35 dark:text-indigo-200"
    case "all":
    default:
      return "bg-slate-700/20 text-slate-800 dark:bg-white/10 dark:text-slate-200"
  }
}

const MiniAction = ({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex flex-col items-center gap-2
        active:scale-[0.98]
        transition
        select-none
      "
    >
      <div
        className="
          h-14 w-14 rounded-2xl
          bg-white/90 dark:bg-slate-900/70
          shadow-[0_10px_24px_rgba(0,0,0,0.12)]
          ring-1 ring-black/5 dark:ring-white/10
          flex items-center justify-center
        "
      >
        {icon}
      </div>
      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {label}
      </div>
    </button>
  )
}

const Row = ({
  tx,
  mode,
  onOpen
}: {
  tx: SectionTx
  mode: Mode
  onOpen?: (tx: SectionTx) => void
}) => {
  const hasHash = !!tx.hash
  const clickableClass = hasHash ? "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5" : "cursor-default opacity-70"
  const plus = tx.type1 === "received"

  return (
    <div
      onClick={() => hasHash && onOpen?.(tx)}
      className={[
        "flex items-center gap-2 px-3 py-3",
        "border-b border-slate-200/70 dark:border-slate-800/70",
        "transition",
        clickableClass
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <AccountBeo address={tx.address} note="" dateData={formatTimev2(tx.date)} tx={tx} localMode={mode} />
      </div>

      <div className="shrink-0 flex items-center gap-1">
        {mode !== "pay" && (
          <span
            className={[
              "inline-flex items-center justify-center",
              "w-7 h-7 rounded-full",
              getBadgeClass(tx.type as HistoryFilter)
            ].join(" ")}
            title={tx.type}
          >
            {tx.type === "pending" ? (
              <Loader className="w-4 h-4" strokeWidth={2} />
            ) : tx.type === "completed" ? (
              <CalendarCheck className="w-4 h-4" strokeWidth={2} />
            ) : tx.type === "paid" || tx.type === "deposited" ? (
              <Banknote className="w-4 h-4" strokeWidth={2} />
            ) : (
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            )}
          </span>
        )}
      </div>

      <div
        className={[
          "shrink-0 whitespace-nowrap text-right w-[150px] font-medium tabular-nums",
          plus ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
        ].join(" ")}
      >
        <div className="flex justify-end items-start gap-1.5">
          <span className="text-[14px] leading-[20px]">{plus ? "+" : "−"}</span>

          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-[14px] font-semibold tabular-nums leading-[20px]">
              {formatAmount(tx.type === "sent" ? tx.preAmount : tx.amount, "USDC")} USDC
            </span>

            {tx?.requestDetail && (
              <span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
                {fiatPrefix(tx.requestDetail.requestCurrency)}{" "}
                {formatAmount(
                  tx.type1 === "sent" ? tx.requestDetail.totalPayCurrency : tx.requestDetail.requestCurrencyAmount||0,
                  tx.requestDetail.requestCurrency
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MyWalletDashboard() {
	const navigate = useNavigate()
	const {
		profiles,
		myAddress,
		setMyAddress,
		setUsdcbalance,
		usdcbalance,
		currencyData,
		setUsdcToUSD,
		setShowFooter,
		setNavigateLeftButtonArray,
		historyPayData,
		setSecureCode,	
		redeemCode,
		setRedeemCode,
	} = useDaemonContext()

	const [loading, setLoading] = useState(false)
	const [allItems, setAllItems] = useState<TransferHistork[]>([])
	const [reflash, setReflash] = useState(false)
	const [settingsOpen, setSettingsOpen] = useState<''|'Pay'|'BeamioPayMe'|'Cashcode'|'BankingBridge'|'RedeemScreen'>('')
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|'TransactionsItemDetail'|
			''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')

	const [itemTx, setItemtx] = useState<TransferHistork>()


	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])

	const fxRateUSDCToCurrency = useCallback(
		(currency: ICurrency) => {
		const u2u = (currencyData as any)?.USDC ?? 1
		if (currency === "USD") return u2u
		const usdToCurrency = (currencyData as any)?.[currency]
		if (typeof usdToCurrency !== "number") return u2u
		return u2u * usdToCurrency
		},
		[currencyData]
	)

	useEffect(() => {
		if (historyPayData) {
			setShowFooter(false)
			setSettingsOpen('Pay')
			return
		}
		if (redeemCode) {

			setSettingsOpen('RedeemScreen')
			return
		}
	}, [redeemCode, historyPayData])

	const balanceFiat = useMemo(() => {
		const c: ICurrency = "CAD"
		const rate = fxRateUSDCToCurrency(c)
		const n = Number(usdcbalance || 0)
		if (!isFinite(rate) || !isFinite(n)) return 0
		return n * rate
	}, [usdcbalance, fxRateUSDCToCurrency])

	const load = useCallback(async () => {
		if (!profiles?.length) return
		const profile: profile = profiles[0]
		const address = profile.keyID
		if (!myAddress) setMyAddress(address)

		setLoading(true)
		try {
		const myAddrLocal = address.toLowerCase()

		const [_transfer, _links, _checks] = await Promise.all([
			beamioConet.getTransferHistory(address, 0, 100),
			beamioConet.getLinksHistory(address, 0, 100),
			beamioConet.getCheckHistory(address, 0, 100)
		])

		const transfer: Transfer[] = _transfer[1]
		const mappedPay: TransferHistork[] = transfer.map(n => {
			let requestDetail: IRequestCurrencyDetail | undefined = undefined
			let card: IImageCard | null = null
			let payme: payMe | null = null

			const nodeEX = n?.note?.split("\r\n") || []
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

			const amount = Number(ethers.formatUnits(n.amount, 6))
			const _amount = Number((payme as any)?.currencyAmount)

			if ((payme as any)?.currency && fiatPrefix((payme as any).currency) && !isNaN(_amount) && _amount > 0) {
				const currencyRate = Number((payme as any).currencyAmount) / amount
				requestDetail = {
					requestCurrency: (payme as any).currency,
					totalPayCurrency: Number((payme as any).currencyAmount),
					totalPayUSDC: amount,
					feeCurrency: 0,
					feeUSDC: 0,
					receivedCurrency: Number((payme as any).currencyAmount),
					receivedUSDC: amount,
					currencyTip: 0,
					USDCTip: 0,
					rate: currencyRate,
					title: (payme as any)?.title,
					textNote: paymeData > -1 ? nodeEX[paymeData] : "",
					requestCurrencyAmount: Number((payme as any).currencyAmount),
				}
			}

			const ret: TransferHistork = {
				date: Number(n.timestamp * BigInt(1000)),
				amount,
				address: n.from.toLowerCase() === myAddrLocal ? n.to.toLowerCase() : n.from.toLowerCase(),
				hash: n.finisedHash,
				requestCurrency: (payme as any)?.currency || "USDC",
				note: n.note,
				type: myAddrLocal === n.to.toLowerCase() ? "received" : "sent",
				mode: "pay",
				fee: 0,
				type1: myAddrLocal === n.to.toLowerCase() ? "received" : "sent",
				preAmount: amount,
				requestDetail
			}

			if (card?.image) ret.card = card
			return ret
		})

		const links: LinksHistory[] = _links[1]
		let mappedLinks: TransferHistork[] = links.map(n => {
			const isRequest = n.from.toLowerCase() === myAddrLocal
			const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
			const isReject = isRequest
			? n.to === "0x1000000000000000000000000000000000000000"
			: n.from === "0x1000000000000000000000000000000000000000"

			const account = isPending || isReject ? "" : isRequest ? n.to : n.from

			const payAmount = Number(ethers.formatUnits(n.payAmount, 6))
			const _requestCurrencyData = (n?.node || "").split("\r\n")
			const tail = _requestCurrencyData[_requestCurrencyData.length - 1]

			let requestCurrency: ICurrency = "USDC"
			let group: paymentType = "onetime"
			let requestDetail: IRequestCurrencyDetail | undefined = undefined
			let type: HistoryFilter = isPending ? "pending" : isRequest ? "sent" : "received"

			try {
			const kkk = JSON.parse(tail)
			if (kkk) {
				requestCurrency = kkk.currency
				if (typeof kkk?.oneTimeMode === "undefined") group = "payme"
				else group = kkk.oneTimeMode ? "onetime" : "reusable"
			}

			const totalPayUSDC = payAmount
			if (totalPayUSDC) {
				const feeUSDC = calcFeeFromReceived(totalPayUSDC)
				const requestCurrencyAmount = Number(kkk?.currencyAmount || 0)
				const currencyTip = Number(kkk?.currencyTip || 0)
				const taxCurrency = Number(kkk?.currencyTax || 0)
				const currencyRate = (requestCurrencyAmount + currencyTip + taxCurrency) / totalPayUSDC
				const requestUSDAmount = currencyRate > 0 ? requestCurrencyAmount / currencyRate : 0

				const totalPayCurrency = totalPayUSDC * currencyRate
				const feeCurrency = feeUSDC * currencyRate
				const USDCTip = currencyRate ? currencyTip / currencyRate : 0
				const receivedUSDC = totalPayUSDC - feeUSDC
				const receivedCurrency = receivedUSDC * currencyRate
				const taxUSDC = currencyRate ? taxCurrency / currencyRate : 0
				const title = kkk?.title
				const textNote =
				_requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : ""

				requestDetail = {
					requestCurrency,
					totalPayUSDC,
					totalPayCurrency,
					requestCurrencyAmount,
					requestUSDAmount,
					feeUSDC,
					feeCurrency,
					currencyTip,
					USDCTip,
					taxUSDC,
					taxCurrency,
					receivedUSDC,
					receivedCurrency,
					rate: currencyRate,
					code: kkk?.code,
					title,
					textNote
				}
			}

			} catch {
				requestCurrency = tail as ICurrency
			}

			const ret: TransferHistork = {
			date: Number(n.issueTimestamp * BigInt(1000)),
			amount: payAmount - (requestDetail?.feeUSDC || 0),
			address: account,
			hash: n.successAuthorizationHash.startsWith("0x00") ? n.payHash : n.successAuthorizationHash,
			note: n.node,
			type,
			mode: "request",
			fee: 0,
			type1: type === "sent" ? "paid" : type === "pending" ? "" : "received",
			preAmount: payAmount,
			requestCurrency,
			requestDetail,
			group
			}

			return ret
		})

		mappedLinks = mappedLinks.filter(n => !!n?.requestDetail)

		const checks: CheckHistory[] = _checks[1]
		const memoSelfDeposited: Map<string, boolean> = new Map()

		const mappedChecks: TransferHistork[] = await Promise.all(
			checks.map(async n => {
				const text = (n.node || "").split("\r\n")
				const encryptedText = text[1]
				
				let requestDetail: IRequestCurrencyDetail | undefined
				let ce: { secureCode: string; passcode: string } | undefined
				try {
					const cleanText = encryptedText ? await aesGcmDecrypt(encryptedText, profile.privateKeyArmor) : undefined
					if (cleanText) ce = JSON.parse(cleanText)
				} catch {}

				const isCreator = n.from.toLowerCase() === myAddrLocal
				const isreceiver = n.to.toLowerCase() === myAddrLocal
				

				const account = n.to.toLowerCase() !== ethers.ZeroAddress ? n.to.toLowerCase() : ''

				const type: HistoryFilter = !account ? "pending" : isCreator ? "completed" : "deposited"


				const totalPayUSDC = Number(ethers.formatUnits(n.amount, 6))
				const costUSDC = calcFeeFromReceived(totalPayUSDC)
				let amount = type === 'deposited' ? totalPayUSDC - costUSDC : totalPayUSDC

				let hash = type === 'pending' ? n.successAuthorizationHash : n.depositHash

				let type1: HistoryFilter = type === "deposited" ? "received" : "sent"

				let card: IImageCard | undefined
				let payme: payMe | undefined

				const nodeEX = n?.node?.split("\r\n") || []
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


				
					const feeUSDC = costUSDC
					const requestCurrencyAmount = Number(payme?.currencyAmount || 0)
					const requestUSDAmount = totalPayUSDC - feeUSDC
					
					
					const currencyRate = requestCurrencyAmount / requestUSDAmount

					const feeCurrency = feeUSDC * currencyRate

					const totalPayCurrency = totalPayUSDC * currencyRate
					
					const receivedCurrency = requestCurrencyAmount
					
					const title = payme?.title
					const textNote = nodeEX[0]||''
					

					requestDetail = {
						requestCurrency: payme?.currency || "USDC",
						totalPayUSDC,
						totalPayCurrency,
						requestCurrencyAmount,
						requestUSDAmount,
						feeUSDC: type === 'deposited' ? 0 : feeUSDC,
						feeCurrency: type === 'deposited' ? 0 : feeCurrency,
						currencyTip: 0,
						USDCTip: 0,
						taxUSDC: 0,
						taxCurrency: 0,
						receivedUSDC: type === 'deposited' ? 0 : requestUSDAmount,
						receivedCurrency: type === 'deposited' ? 0 : receivedCurrency,
						rate: currencyRate,
						title,
						textNote
					}
				

					return {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						address: account ? account.toLowerCase() : "",
						hash,
						note: n.node,
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: "cashcode",
						fee: costUSDC,
						type1,
						preAmount: totalPayUSDC,
						card,
						payme,
						requestDetail
					}
				}
			)
		)

		const merged = [...mappedPay, ...mappedLinks, ...mappedChecks].sort((a, b) => b.date - a.date)
		setAllItems(merged)
		} finally {
		setLoading(false)
		}
	}, [profiles, myAddress, setMyAddress])

	useEffect(() => {
		if (!myAddress && profiles?.[0]?.keyID) setMyAddress(profiles[0].keyID)
		if (myAddress) getBalanceProcess(myAddress, setUsdcbalance, setUsdcToUSD)
	}, [myAddress, profiles, setMyAddress, setUsdcbalance, setUsdcToUSD])

	useEffect(() => {
		load()
	}, [load])

	const activePending = useMemo(() => {
		return allItems
		.filter(tx => {
			const isPending = tx.type === "pending"
			const isRequestActive = tx.mode === "request" && tx.type === "sent"
			const isCashcodeReady = tx.mode === "cashcode" && tx.type === "pending"
			return isPending || isRequestActive || isCashcodeReady
		})
		.slice(0, 3)
	}, [allItems])

	const history = useMemo(() => {
		return allItems
		.filter(tx => {
			// if (tx.mode === "pay") return tx.type1 !== ""
			// if (tx.mode === "request") return tx.type !== "pending"
			// if (tx.mode === "cashcode") return tx.type !== "pending"
			return tx.type1 ==='received' || tx.type1 === 'sent'
		})
		.slice(0, 6)
	}, [allItems])

  	const reflashProcess = async () => {
		if (reflash) return
		const profile: profile = profiles[0]
		setReflash(true)

		await getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		setReflash(false)
	}


  return (
    <div
      className="
        w-full h-full min-h-0
        flex flex-col
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        pt-[calc(env(safe-area-inset-top)+0.75rem)]
        pb-[calc(env(safe-area-inset-bottom)+5.5rem)]
      "
    >
      {/* Top bar */}
      <div className="px-5 flex items-center justify-between">
        <div className="text-[18px] font-semibold text-slate-900 dark:text-slate-100">
          My Wallet
        </div>

        
      </div>

		{/* Balance card */}
		<div className="px-5 mt-4">
		<div
			className="
			relative
			min-h-[14rem]
			rounded-[26px]
			bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b]
			p-4
			shadow-lg
			mb-4
			overflow-hidden
			"
		>
			{/* badges */}
			<div className="flex items-center justify-between">
			{/* Left */}
			<div className="flex items-center gap-1 text-white">
				<button
				type="button"
				className="
					inline-flex items-center justify-center
					w-7 h-7
					rounded-full
					border border-white/60
					bg-transparent
					transition
					hover:bg-white/10
					active:scale-[0.95]
					focus:outline-none
					focus-visible:ring-2
					focus-visible:ring-white/40
					disabled:opacity-60
					disabled:active:scale-100
				"
				onClick={reflashProcess}
				disabled={reflash}
				aria-label="Refresh"
				>
				<img
					src={base_icon}
					alt="Base"
					className={[
					"w-5 h-5 object-contain",
					reflash ? "animate-spin opacity-80" : ""
					].join(" ")}
				/>
				</button>

				<span className="text-[15px] font-medium tracking-wide">
				USDC on Base
				</span>
			</div>

			{/* Right — Gas sponsored */}
			<div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
				<Sparkles className="w-4 h-4 text-amber-500" strokeWidth={2.2} />
				<span className="text-[11px] font-medium text-white">
				Gas sponsored
				</span>
			</div>
			</div>

			{/* centered balance (leave room for top badges) */}
			<div className="absolute inset-x-0 inset-y-0 flex items-center justify-center text-center pointer-events-none pt-10">
			<div>
				<div className="flex items-end justify-center gap-2">
				<div className="text-[44px] leading-[44px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
					{formatWithThousands(usdcbalance)}
				</div>
				<div className="pb-[6px] text-[14px] font-semibold text-white/85">
					USDC
				</div>
				</div>

				<div className="mt-2 text-[13px] text-white/80 tabular-nums">
				≈ {fiatPrefix("CAD")} {formatWithThousands(balanceFiat)}
				</div>
			</div>
			</div>

			{/* soft glow */}
			<div className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/18 blur-3xl" />
		</div>
		</div>

      {/* Actions */}
      <div className="px-8 mt-4">
        <div className="flex items-start justify-between">
          <MiniAction
            label="Send"
            icon={<ArrowUpRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => {
				setSettingsOpen('Pay')
				setShowFooter(false)
				
			}}
          />
          <MiniAction
            label="Request"
            icon={<ArrowDownLeft className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => {
				setSettingsOpen('BeamioPayMe')
				setShowFooter(false)
			}}
          />
          <MiniAction
            label="Cashcode"
            icon={<ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => {
				setSettingsOpen('Cashcode')
				setShowFooter(false)
			}}
          />
          <MiniAction
            label="Bank"
            icon={<Landmark className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => {
				setSettingsOpen('BankingBridge')
				setShowFooter(false)
			}}
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4">
        {/* Active & Pending */}
        <div className="px-5">
          <div className="flex items-center gap-2 px-2 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F78FF]" />
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              Active & Pending
            </div>
            {loading && <Loader className="w-3.5 h-3.5 text-slate-400 animate-spin" strokeWidth={2.2} />}
          </div>

          
            {activePending.length ? (
				<>
				<ActivePannel
					items ={activePending}
					onOpen={tx => {
						setItemtx(tx)
						setShowAlphaHowItWorks('TransactionsItemDetail')
						setShowFooter(false)
						
					}}
				/>
			
              
			  </>
            ) : (
              <div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
                No active items
              </div>
            )}
          
        </div>

        {/* History */}
        <div className="px-5 mt-4">
          <div className="px-2  flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              History
            </div>
            <button
              type="button"
              onClick={() => navigate("/HistoryAll")}
              className="text-[12px] font-semibold text-[#2F78FF] active:opacity-70"
            >
              View All
            </button>
          </div>

          <div
            className="
              mt-3 overflow-hidden
              rounded-2xl
              bg-white/85 dark:bg-slate-900/65
              ring-1 ring-black/5 dark:ring-white/10
              shadow-[0_10px_24px_rgba(0,0,0,0.08)]
            "
          >
            {history.length ? (
              history.map(tx => (
                <Row key={`${tx.mode}-${tx.hash}-${tx.date}`} tx={tx} mode={tx.mode} onOpen={(tx) => {
					setShowAlphaHowItWorks('TransactionsItemDetail')
					setItemtx(tx)
					setShowFooter(false)

				}} />
              ))
            ) : (
              <div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
                No history yet
              </div>
            )}
          </div>

        </div>

		{showAlphaHowItWorks && createPortal(
			<AnimatePresence>
				<motion.div
					key="modal-overlay"
					className="
						fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
					"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "100%" }}
					transition={{ duration: 0.28, ease: "easeOut" }}
					onTouchMove={(e) => e.stopPropagation()}
				>
				{/* 顶部 Header */}
				<BeamioNavBack
					title=''
					
					onClose={() => {
						
						setShowAlphaHowItWorks('')
						setShowFooter(true)
					}}
					onMore={() => {

					}}
				/>

					{/* 内容区域 */}
					<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
						
						

						{
							showAlphaHowItWorks === 'TransactionsItemDetail' && itemTx &&
							<TransactionsItemDetail
								localMode='pay' tx={itemTx}
							/>
						}

					</div>
				</motion.div>
			</AnimatePresence>
			, document.body
		)}



		{/* bottom 向上弹出窗口: 避开 footer + iOS 安全区 */}
		<div
			className="
			h-[96px]
			pb-[env(safe-area-inset-bottom)]
			pointer-events-none
			"
		/>


		
			<div
			className={[
				"fixed inset-0 z-40",
				settingsOpen ? "pointer-events-auto" : "pointer-events-none"
			].join(" ")}
			>
				{/* 灰色遮罩：父页面不可用 */}
				<div
					className={[
					"absolute inset-0",
					"bg-black/50 transition-opacity duration-300 ease-out",
					settingsOpen ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen('')
						setSecureCode('')
						setRedeemCode('')



					}}
				/>

				{/* Bottom Sheet：全宽，从底部上来 */}
				<div
					className={[
					"absolute inset-x-0 bottom-0",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体：h-auto 自适应内容高度 */}
					<div
					className={[
						"w-full",
						"bg-white dark:bg-slate-900",
						"rounded-t-[22px]",
						"shadow-[0_-12px_40px_rgba(0,0,0,0.18)]",

						// ✅ 自适应高度，但最多不超过屏幕（避免顶到状态栏）
						// 你也可以改成 90dvh
						"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
						"h-auto",

						// ✅ 安全区：底部留出 Home indicator
						"pb-[env(safe-area-inset-bottom)]"
					].join(" ")}
					>
						{/* 顶部拖拽条（可选） */}
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>


						{/* 内容区：内容少就不滚动；内容多才滚动 */}
						<div className="px-4 pb-4 overflow-y-auto">
							{settingsOpen === "Pay" && (
								<PayScreen
									beamioer={historyPayData||undefined}
									close={(path) => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
								/>
							)}
							{
								settingsOpen === 'BeamioPayMe' && 
								<PaymentLink 
									
									close={() => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
								/>
							}

							{
								settingsOpen === 'Cashcode' && 
								<Cashcode 
									close={() => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
									
								/>
							}
							{
								settingsOpen === 'BankingBridge' && 
								<BankingBridge 
									onAddCash={() => {

									}}
									onCashOut={() => {

									}}
									
								/>
							}

							{
								settingsOpen === 'RedeemScreen' && 
								<RedeemScreen 
									close={() => {
										setShowFooter(true)
										setSecureCode('')
										setRedeemCode('')
										setSettingsOpen('')
									}}
								/>
							}
							<div
								className="
								h-[24px]
								pb-[env(safe-area-inset-bottom)]
								pointer-events-none
								"
							/>
						</div>
					</div>
				</div>
			</div>
      </div>
    </div>
  )
}
