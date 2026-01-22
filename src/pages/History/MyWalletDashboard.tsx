import React, { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ethers } from "ethers"
import { beamioConet } from "@/utils/constants"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getBalanceProcess, formatWithThousands, aesGcmDecrypt } from "@/services/beamio"
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
          {mode === "pay" && <span className="text-[14px] leading-[20px]">{plus ? "+" : "−"}</span>}

          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-[14px] font-semibold tabular-nums leading-[20px]">
              {formatAmount(tx.type === "sent" ? tx.preAmount : tx.amount, "USDC")} USDC
            </span>

            {tx?.requestDetail && (
              <span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
                {fiatPrefix(tx.requestDetail.requestCurrency)}{" "}
                {formatAmount(
                  tx.type === "sent" ? tx.requestDetail.totalPayCurrency : tx.requestDetail.receivedCurrency,
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
    setNavigateLeftButtonArray
  } = useDaemonContext()

  const [loading, setLoading] = useState(false)
  const [allItems, setAllItems] = useState<TransferHistork[]>([])
  const [reflash, setReflash] = useState(false)

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
          if (paymeData > -1) payme = JSON.parse(nodeEX[paymeData--])
        } catch {
          paymeData++
        }

        try {
          if (paymeData > -1) {
            const cardData = JSON.parse(nodeEX[paymeData--])
            card = cardData?.card || cardData
          }
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
            textNote: paymeData > -1 ? nodeEX[paymeData] : ""
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
          let cleanText = ""

          try {
            if (encryptedText) cleanText = await aesGcmDecrypt(encryptedText, profile.privateKeyArmor)
          } catch {}

          let ce: { secureCode: string; passcode: string } | undefined
          if (cleanText) ce = JSON.parse(cleanText)

          const isSend = n.from.toLowerCase() === myAddrLocal
          const account = isSend ? (n.to === ethers.ZeroAddress ? "" : n.to) : n.from === ethers.ZeroAddress ? "" : n.from

          const type: HistoryFilter = !account ? "pending" : isSend ? "completed" : "deposited"
          const preAmount = Number(ethers.formatUnits(n.amount, 6))
          const fee = calcFeeFromNumber(preAmount)

          let amount = preAmount
          let hash = n.successAuthorizationHash
          let type1: HistoryFilter | "" = type === "deposited" ? "received" : "sent"

          if (account?.toLowerCase?.() === myAddrLocal) {
            const isMemo = memoSelfDeposited.get(n.depositHash)
            if (!isMemo) {
              memoSelfDeposited.set(n.depositHash, true)
              type1 = "sent"
            } else {
              type1 = "received"
              hash = n.depositHash
              amount = preAmount - fee
            }
          } else {
            if (type1 === "received") {
              amount = amount - fee
              hash = n.depositHash
            }
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
            fee,
            type1,
            preAmount
          }
        })
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
        if (tx.mode === "pay") return tx.type1 !== ""
        if (tx.mode === "request") return tx.type !== "pending"
        if (tx.mode === "cashcode") return tx.type !== "pending"
        return true
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

  const openTxDetail = (tx: TransferHistork) => {
    const params = new URLSearchParams(
      tx.mode === "request"
        ? { code: tx.hash }
        : { secureCode: tx.hash, cashcode: tx.security || "" }
    ).toString()

    const showUrl = `${showPaylinkSite}?${params}`

    setShowFooter(false)
    setNavigateLeftButtonArray(prev => [
      ...prev,
      {
        title: "",
        action: [
          () => setShowFooter(true)
        ]
      }
    ])

    navigate(`/History?detail=1&u=${encodeURIComponent(showUrl)}`)
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

        {/* <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/QR")}
            className="
              h-9 w-9 rounded-full
              bg-white/80 dark:bg-slate-900/60
              ring-1 ring-black/5 dark:ring-white/10
              shadow-[0_8px_20px_rgba(0,0,0,0.10)]
              flex items-center justify-center
              active:scale-95 transition
            "
            aria-label="QR"
          >
            <QrCode className="w-4.5 h-4.5 text-slate-700 dark:text-slate-100" strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={() => navigate("/Notifications")}
            className="
              h-9 w-9 rounded-full
              bg-white/80 dark:bg-slate-900/60
              ring-1 ring-black/5 dark:ring-white/10
              shadow-[0_8px_20px_rgba(0,0,0,0.10)]
              flex items-center justify-center
              active:scale-95 transition
            "
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-slate-700 dark:text-slate-100" strokeWidth={2.2} />
          </button>
        </div> */}
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
      <div className="px-5 mt-4">
        <div className="flex items-start justify-between">
          <MiniAction
            label="Send"
            icon={<ArrowUpRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => navigate("/Pay")}
          />
          <MiniAction
            label="Request"
            icon={<ArrowDownLeft className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => navigate("/Request")}
          />
          <MiniAction
            label="Cashcode"
            icon={<ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => navigate("/Cashcode")}
          />
          <MiniAction
            label="Bank"
            icon={<Landmark className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
            onClick={() => navigate("/Bank")}
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-4">
        {/* Active & Pending */}
        <div className="px-5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F78FF]" />
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              Active & Pending
            </div>
            {loading && <Loader className="w-3.5 h-3.5 text-slate-400 animate-spin" strokeWidth={2.2} />}
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
            {activePending.length ? (
              activePending.map(tx => (
                <Row key={`${tx.mode}-${tx.hash}-${tx.date}`} tx={tx} mode={tx.mode} onOpen={openTxDetail} />
              ))
            ) : (
              <div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
                No active items
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="px-5 mt-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
              History
            </div>
            <button
              type="button"
              onClick={() => navigate("/History")}
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
                <Row key={`${tx.mode}-${tx.hash}-${tx.date}`} tx={tx} mode={tx.mode} onOpen={openTxDetail} />
              ))
            ) : (
              <div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
                No history yet
              </div>
            )}
          </div>

        </div>

		{/* bottom spacer: 避开 footer + iOS 安全区 */}
		<div
			className="
			h-[96px]
			pb-[env(safe-area-inset-bottom)]
			pointer-events-none
			"
		/>
      </div>
    </div>
  )
}
