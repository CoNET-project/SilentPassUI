import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { searchUsername } from "@/services/beamio"
import { ethers } from "ethers"
import {formatAmount, fiatPrefix} from '@/services/currency'



const getImg = (avatarSeed: string) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
  const lastname = item?.last_name?.split("\r\n") || []
  const fullName = `${item?.first_name || ""} ${/^\{/.test(lastname[0]) ? "" : lastname[0] || ""}`.trim()
  return fullName || item.username && `@${item.username}` || item.address
}

const unknowAcc = (address: string): searchResult => ({
  address,
  created_at: 0,
  first_name: "",
  last_name: "",
  follow_count: "",
  follower_count: "",
  username: "Unknow",
  image: ""
})



const fmtAddr = (a = "") =>
  a && a !== ethers.ZeroAddress ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"

const parseNote = (tx: TransferHistork) => {
	const parts = (tx.note || "").split("\r\n")
	const memo = (parts[0] || "").trim()

	
	const currency = tx?.requestCurrency !== 'USDC'
	? `${fiatPrefix(tx?.requestDetail?.requestCurrency ||'USDC')} ${formatAmount(tx?.requestDetail?.totalPayCurrency||0, tx?.requestDetail?.requestCurrency||'USDC')} ${tx?.requestDetail?.requestCurrency === 'USDC' ? 'USDC' : ''}`
	: `${formatAmount(tx.amount, 'USDC', 2)} USDC`
	return { memo, currency }
}

const getUSDCAmount = (tx: TransferHistork) => {
	const ret = tx?.requestDetail?.totalPayUSDC
	? `${formatAmount( tx?.requestDetail?.totalPayUSDC, 'USDC', 2)} USDC`
	: `${formatAmount(tx.amount, 'USDC', 2)} USDC`
	return ret
}

const fmtAmount = (n: number, digits = 2) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(n) ? n : 0)

const formatTimev2 = (ts: number) => {
  const d = new Date(ts)
  if (!isFinite(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  })
}

function usePeerProfile(address: string) {
  const { beamioUsers, setbBeamioUsers, beamio } = useDaemonContext()
  const [peer, setPeer] = useState<searchResult>(() => unknowAcc(address))
  const [img, setImg] = useState("")

  const findingRef = useRef(false)

  const findUser = useCallback(async () => {
    
    if (findingRef.current) return
    findingRef.current = true
	
    try {
      const addr = address?.toLowerCase()|| beamio?.accountName||''

      let account = beamioUsers.find(n => (n?.address || "").toLowerCase() === addr)
		
      if (!account) {
        const _account = await searchUsername(addr)
        if (_account?.results?.[0]) account = _account.results[0]
      }

      if (!account) {
        account = unknowAcc(address)
      } else if (!account.image) {
        account.image = getImg(account.username)
      }

      setPeer(account)
      setImg(account.image || getImg(account.username))

      // cache to global
      // @ts-ignore
      setbBeamioUsers(prev => {
        const a = (account?.address || "").toLowerCase()
        // @ts-ignore
        if (prev.some(u => (u.address || "").toLowerCase() === a)) return prev
        return [...prev, account!]
      })
    } finally {
      findingRef.current = false
    }
  }, [address, beamioUsers, setbBeamioUsers])

  useEffect(() => {
    findUser()
  }, [findUser])

  const name = peer.username !== "Unknow" ? displayName(peer) : fmtAddr(peer.address)
  const avatar = peer.username !== "Unknow" ? (img || getImg(peer.username)) : ""

  return { peer, name, avatar }
}

function ActiveCapsuleItem({
	tx,
	myName,
	onOpen
}: {
	tx: TransferHistork
	myName: string
	onOpen?: (tx: TransferHistork) => void
}) {
	// ✅ Hook 在组件顶层：合法
	
	const { usdcToUSD, usdcbalance, beamio } = useDaemonContext()
	const { name: peerName, avatar } = usePeerProfile( tx.type === "sent" ? beamio?.address||'' : tx.address)
	const { memo, currency } = parseNote(tx)
	const hasHash = !!tx.hash
	const isSent = tx.type === "sent"
	const isReceived = tx.type === "received"

	const title =
		tx.mode === "cashcode"
		? `${peerName} redeemed Cashcode`
		: isSent
			? `${myName} paid ${peerName}`
			: `${peerName} paid ${myName}`

	const raw = isSent ? (tx.preAmount || tx.amount) : tx.amount
	const rightAmount = `${isSent ? "−" : "+"}${currency}`
	const clickable = hasHash
		? "cursor-pointer hover:bg-slate-50 active:scale-[0.995]"
		: "cursor-default opacity-70"

	return (
		<button
			type="button"
			onClick={() => hasHash && onOpen?.(tx)}
			className={[
				"w-full text-left",
				"rounded-[22px] px-5 py-3",
				"bg-white",
				"shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
				"ring-1 ring-black/5",
				"transition",
				clickable
			].join(" ")}
		>
		<div className="flex items-start gap-3">
			{/* avatar */}
			<div className="shrink-0 w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
			{avatar ? (
				<img src={avatar} className="w-full h-full object-cover" alt="" />
			) : (
				<span className="text-slate-400 font-semibold">?</span>
			)}
			</div>

			{/* content */}
			<div className="flex-1 min-w-0">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
				<div className="truncate text-[13px] leading-[20px] text-slate-900">
					<span className="font-semibold">{title}</span>
				</div>

				{!!memo && (
					<div className="truncate mt-0.5 text-[13px] leading-[18px] text-slate-500">
						{memo}
					</div>
				)}
				</div>

				
				<div className="shrink-0 whitespace-nowrap tabular-nums text-right">
					{/* 上行：USDC */}
					<div
						className={[
						"text-[14px] leading-[22px] font-semibold",
						isSent ? "text-slate-900" : "text-emerald-600"
						].join(" ")}
					>
						<span className="mr-0.5">
						{isSent ? "−" : "+"}
						</span>
						{getUSDCAmount(tx)}
					</div>

					{/* 下行：非 USDC 时显示原币 */}
					{tx?.requestDetail?.requestCurrency !== "USDC" &&
						typeof tx?.requestDetail?.totalPayUSDC === "number" && (
						<div className="mt-0.5 text-[11px] leading-[14px] text-slate-400">
							
							{rightAmount}
						</div>
						)}
					</div>
				
			</div>

			{/* {tx.group === "merchant" && (
				<div className="mt-2">
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 ring-1 ring-black/5">
					<CheckCircle2 className="w-3.5 h-3.5" />
					Verified Merchant Payment
				</span>
				</div>
			)} */}

			<div className="mt-1 text-[11px] text-slate-400">
				{formatTimev2(tx.date)}
			</div>
			</div>
		</div>
		</button>
	)
}

type ActivePannelProps = {
  items: TransferHistork[]
  onOpen?: (tx: TransferHistork) => void
  className?: string
}

export default function ActivePannel({
  items,
  onOpen,
  className = ""
}: ActivePannelProps) {
  const { beamio } = useDaemonContext()

  const latest5 = useMemo(() => {
    return [...(items || [])].sort((a, b) => b.date - a.date).slice(0, 5)
  }, [items])


  return (
    <div className={["space-y-3", className].join(" ")}>
      {latest5.map(tx => (
        <ActiveCapsuleItem
          key={tx.hash || `${tx.date}-${tx.address}`}
          tx={tx}
          myName="You"
          onOpen={onOpen}
        />
      ))}
	   {/* bottom spacer: 避开 footer + iOS 安全区 */}
		<div
			className="
			h-[96px]
			pb-[env(safe-area-inset-bottom)]
			pointer-events-none
			"
		/>
    </div>
  )
}
