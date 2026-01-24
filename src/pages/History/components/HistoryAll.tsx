import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { ethers } from "ethers"
import { motion, AnimatePresence } from "framer-motion"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { beamioConet } from "@/utils/constants"
import { getBalanceProcess, aesGcmDecrypt } from "@/services/beamio"
import { fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived, calcFeeFromNumber } from "@/services/currency"
import AccountBeo from "../AccountBea"
import { TransactionsItemDetail } from "@/pages/History/TransactionsItemDetail"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import {
  Search,
  X,
  Loader,
  CalendarCheck,
  Banknote,
  HelpCircle
} from "lucide-react"

type SectionTx = TransferHistork

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

type HistorySection = {
  key: string
  title: string
  items: TransferHistork[]
  kind: "day" | "month" | "year"
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayDiff(today0: Date, d0: Date) {
  return Math.floor((today0.getTime() - d0.getTime()) / 86_400_000)
}

function fmtMonthYear(d: Date) {
  return d
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase()
}

function fmtWeekday(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
}

function groupHistory(items: TransferHistork[], now = new Date()): HistorySection[] {
  const today0 = startOfDay(now)
  const currentYear = now.getFullYear()

  const sorted = [...items].sort((a, b) => b.date - a.date)

  const map = new Map<string, HistorySection>()

  for (const tx of sorted) {
    const d = new Date(tx.date)
    const d0 = startOfDay(d)
    const diff = dayDiff(today0, d0)

    // 1) 一周内：按天
    if (diff >= 0 && diff <= 6) {
      let title = fmtWeekday(d0)
      if (diff === 0) title = "TODAY"
      if (diff === 1) title = "YESTERDAY"

      const key = `day:${d0.getFullYear()}-${d0.getMonth()}-${d0.getDate()}`
      let sec = map.get(key)
      if (!sec) {
        sec = { key, title, items: [], kind: "day" }
        map.set(key, sec)
      }
      sec.items.push(tx)
      continue
    }

    // 2) 超过一周：今年内按月
    if (d.getFullYear() === currentYear) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const key = `month:${ym}`
      const title = fmtMonthYear(new Date(d.getFullYear(), d.getMonth(), 1))

      let sec = map.get(key)
      if (!sec) {
        sec = { key, title, items: [], kind: "month" }
        map.set(key, sec)
      }
      sec.items.push(tx)
      continue
    }

    // 3) 跨年：按年
    {
      const y = String(d.getFullYear())
      const key = `year:${y}`
      const title = y

      let sec = map.get(key)
      if (!sec) {
        sec = { key, title, items: [], kind: "year" }
        map.set(key, sec)
      }
      sec.items.push(tx)
    }
  }

  const sections = Array.from(map.values())
  sections.sort((a, b) => (b.items[0]?.date ?? 0) - (a.items[0]?.date ?? 0))
  return sections
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <div className="text-[12px] tracking-[0.22em] font-extrabold text-slate-300">
        {title}
      </div>
    </div>
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
  const clickableClass = hasHash
    ? "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5"
    : "cursor-default opacity-70"
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

export default function HistoryAll() {
  const {
    profiles,
    myAddress,
    setMyAddress,
    setUsdcbalance,
    setUsdcToUSD,
    setShowFooter
  } = useDaemonContext()

  const [loading, setLoading] = useState(false)
  const [allItems, setAllItems] = useState<TransferHistork[]>([])
  const [q, setQ] = useState("")
  const [modeTab, setModeTab] = useState<Mode | "all">("all")

  const [detailOpen, setDetailOpen] = useState(false)
  const [itemTx, setItemTx] = useState<TransferHistork | null>(null)

  const inputRef = useRef<HTMLInputElement | null>(null)

  

  // ✅ 这是主页：进入就打开 footer 导航
  useEffect(() => {
    setShowFooter(true)
  }, [setShowFooter])

  const openDetail = useCallback((tx: TransferHistork) => {
    setItemTx(tx)
    setDetailOpen(true)
    setShowFooter(false)
  }, [setShowFooter])

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    setItemTx(null)
    setShowFooter(true)
  }, [setShowFooter])

  const load = useCallback(async () => {
    if (!profiles?.length) return
    const profile: profile = profiles[0]
    const address = profile.keyID
    if (!myAddress) setMyAddress(address)

    setLoading(true)
    try {
      const myAddrLocal = address.toLowerCase()

      const [_transfer, _links, _checks] = await Promise.all([
        beamioConet.getTransferHistory(address, 0, 200),
        beamioConet.getLinksHistory(address, 0, 200),
        beamioConet.getCheckHistory(address, 0, 200)
      ])

      // ===== pay =====
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

      // ===== request =====
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

      // ===== cashcode =====
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
          const account = isSend
            ? (n.to === ethers.ZeroAddress ? "" : n.to)
            : n.from === ethers.ZeroAddress
              ? ""
              : n.from

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

  const norm = (s: any) => String(s ?? "").toLowerCase().trim()

  const filtered = useMemo(() => {
    const qq = norm(q)

    const byMode = (tx: TransferHistork) => (modeTab === "all" ? true : tx.mode === modeTab)

    const byQuery = (tx: TransferHistork) => {
      if (!qq) return true

      const hay = [
        tx.mode,
        tx.type,
        tx.type1,
        tx.address,
        tx.hash,
        tx.note,
        tx.security,
        tx.passcode,
        tx.redeemHash,
        tx.requestCurrency,
        tx.requestDetail?.title,
        tx.requestDetail?.textNote,
        tx.requestDetail?.code
      ]
        .map(norm)
        .filter(Boolean)
        .join(" ")

      return hay.includes(qq)
    }

    return allItems.filter(tx => byMode(tx) && byQuery(tx))
  }, [allItems, q, modeTab])

  	const sections = useMemo(() => {
		return groupHistory(filtered, new Date())
	}, [filtered])

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
      {/* ✅ 顶部：标题 + iOS 搜索（sticky） */}
      <div className="sticky top-0 z-20 px-5 pb-3 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="pt-1">
          <div className="text-[18px] font-semibold text-slate-900 dark:text-slate-100">
            History
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div
              className="
                flex-1
                rounded-[18px]
                bg-slate-100/90 dark:bg-white/10
                ring-1 ring-black/5 dark:ring-white/10
                shadow-[0_6px_18px_rgba(15,23,42,0.08)]
                px-3 py-2
                flex items-center gap-2
              "
              onClick={() => inputRef.current?.focus()}
            >
              <Search className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all history"
                className="
                  flex-1 bg-transparent outline-none
                  text-[14px] text-slate-900 dark:text-slate-100
                  placeholder:text-slate-400
                "
              />
              {!!q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("")
                    requestAnimationFrame(() => inputRef.current?.focus())
                  }}
                  className="
                    h-7 w-7 rounded-full
                    bg-slate-200/70 dark:bg-white/10
                    flex items-center justify-center
                    active:scale-95 transition
                  "
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4 text-slate-500 dark:text-slate-200" strokeWidth={2.4} />
                </button>
              )}
            </div>

            {!!q && (
              <button
                type="button"
                onClick={() => {
                  setQ("")
                  inputRef.current?.blur()
                }}
                className="text-[14px] font-semibold text-[#2F78FF] active:opacity-70"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {/* {(["all", "pay", "request", "cashcode"] as const).map(k => {
              const active = modeTab === k
              const label = k === "all" ? "All" : k === "pay" ? "Send" : k === "request" ? "Request" : "Cashcode"
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setModeTab(k)}
                  className={[
                    "px-3 py-1.5 rounded-full text-[12px] font-semibold transition",
                    active
                      ? "bg-[#2F78FF] text-white shadow-[0_10px_24px_rgba(47,120,255,0.25)]"
                      : "bg-slate-100/90 dark:bg-white/10 text-slate-600 dark:text-slate-200"
                  ].join(" ")}
                >
                  {label}
                </button>
              )
            })} */}

            <div className="ml-auto flex items-center gap-2">
              {loading && <Loader className="w-4 h-4 text-slate-400 animate-spin" strokeWidth={2.2} />}
              <div className="text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">
                {filtered.length} items
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 h-px bg-slate-200/60 dark:bg-white/10" />
      </div>

      {/* ✅ 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
		<div className="pb-6">
			{sections.length ? (
			sections.map(sec => (
				<div key={sec.key}>
				<SectionHeader title={sec.title} />

				<div
					className="
					mx-5
					overflow-hidden
					rounded-2xl
					bg-white/85 dark:bg-slate-900/65
					ring-1 ring-black/5 dark:ring-white/10
					shadow-[0_10px_24px_rgba(0,0,0,0.08)]
					"
				>
					{sec.items.map(tx => (
					<Row
						key={`${tx.mode}-${tx.hash}-${tx.date}`}
						tx={tx}
						mode={tx.mode}
						onOpen={openDetail}
					/>
					))}
				</div>
				</div>
			))
			) : (
			<div className="px-5 py-6 text-[12px] text-slate-500 dark:text-slate-400">
				No results
			</div>
			)}

			<div className="h-[32px] pb-[env(safe-area-inset-bottom)] pointer-events-none" />
		</div>
		</div>

      {/* ✅ 点击记录：全屏 detail（TransactionsItemDetail） */}
      {detailOpen && itemTx && createPortal(
		<AnimatePresence>
			<motion.div
			key="history-detail"
			className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			exit={{ x: "100%" }}
			transition={{ duration: 0.28, ease: "easeOut" }}
			onTouchMove={(e) => e.stopPropagation()}
			>
			{/* ✅ 顶部 Header：用 BeamioNavBack 返回 HistoryAll */}
			<BeamioNavBack
				title=""
				onClose={() => {
				setDetailOpen(false)
				setItemTx(null)
				setShowFooter(true)
				}}
				onMore={() => {}}
			/>

			{/* 内容区域 */}
			<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
				<TransactionsItemDetail localMode="pay" tx={itemTx} />
			</div>
			</motion.div>
		</AnimatePresence>,
		document.body
		)}
    </div>
  )
}
