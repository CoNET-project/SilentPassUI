import { Search } from "lucide-react"
import { useMemo } from "react"

function formatUsdc4(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return v.toFixed(4)
}

function sumUsdc(list: TransferHistork[]) {
  return list.reduce((acc, tx) => {
    const v =
      Number.isFinite(tx.amount) && tx.amount > 0
        ? tx.amount
        : Number.isFinite(tx.preAmount) && tx.preAmount > 0
          ? tx.preAmount
          : 0
    return acc + v
  }, 0)
}

/** 通用：统计卡片（iOS setting 密度） */
function StatCard(props: {
  title: string
  big: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div
      className="
        flex-1
        min-w-[140px]
        rounded-[12px]
        bg-white
        ring-1 ring-slate-200
        shadow-[0_5px_12px_rgba(15,23,42,0.05)]
        px-2 py-2
      "
    >
      <div className="text-[12px] font-semibold text-slate-500">{props.title}</div>
      <div className="mt-1 text-slate-900">{props.big}</div>
      {props.sub ? <div className="mt-0.5">{props.sub}</div> : null}
    </div>
  )
}

/** 通用：状态 pill（更紧凑） */
function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="
        inline-flex items-center
        px-2.5 py-1
        rounded-full
        bg-white
        ring-1 ring-slate-200
        text-[12px]
        font-semibold
        text-slate-700
        shadow-[0_1px_0_rgba(255,255,255,0.9)]
        whitespace-nowrap
      "
    >
      {children}
    </span>
  )
}

/** 通用：搜索框（更紧凑） */
function SearchBar(props: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div
      className="
        mt-3.5
        rounded-[16px]
        bg-white
        ring-1 ring-slate-200
        shadow-[0_7px_16px_rgba(15,23,42,0.04)]
        px-3.5
        h-[42px]
        flex items-center gap-2.5
      "
    >
      <Search className="w-4 h-4 text-slate-400" />
      <input
        value={props.value}
        onChange={e => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder}
        className="
          flex-1
          bg-transparent
          text-[14px]
          text-slate-700
          placeholder:text-slate-400
          outline-none
        "
      />
    </div>
  )
}

/** ✅ CoverPage：PayMe */
export function PayMeCoverPage(props: {
  payMeArray: TransferHistork[]
  query: string
  setQuery: (v: string) => void
}) {
  const count = props.payMeArray.length
  const receivedUsdc = useMemo(() => sumUsdc(props.payMeArray), [props.payMeArray])

  return (
    <div className="sticky top-0 z-20 bg-white px-4 pt-1.5 pb-4">
      {/* <div className="text-[14px] font-semibold text-slate-500">PayMe · Any amount</div> */}

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <StatCard
          title="Count"
          big={<div className="text-[24px] leading-none font-extrabold">{count}</div>}
        />

        <StatCard
          title="Received"
          big={<div className="text-[20px] leading-none font-extrabold">{formatUsdc4(receivedUsdc)}</div>}
          sub={<div className="text-[12px] font-medium text-slate-500">USDC</div>}
        />

        
      </div>

      <SearchBar value={props.query} onChange={props.setQuery} placeholder="Search payer" />
    </div>
  )
}

/** ✅ CoverPage：Reusable */
export function ReusableCoverPage(props: {
	reusablePayments: TransferHistork[]
	query: string
  	setQuery: (v: string) => void
}) {
  const count = props.reusablePayments.length
  const receivedUsdc = useMemo(() => sumUsdc(props.reusablePayments.filter(n => n.type !== 'pending')), [props.reusablePayments])

  return (
    <div className="sticky top-0 z-20 bg-white px-4 pt-1.5 pb-4">
      {/* <div className="text-[14px] font-semibold text-slate-500">Reusable · Fixed amount</div> */}

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <StatCard
          title="Count"
          big={<div className="text-[24px] leading-none font-extrabold">{count}</div>}
        />

        <StatCard
          title="Received"
          big={<div className="text-[20px] leading-none font-extrabold">{formatUsdc4(receivedUsdc)}</div>}
          sub={<div className="text-[12px] font-medium text-slate-500">USDC</div>}
        />

      </div>

      <SearchBar value={props.query} onChange={props.setQuery} placeholder="Search payer" />
    </div>
  )
}

/** ✅ CoverPage：Invoices */
export function InvoicesCoverPage(props: {
  onetimePayments: TransferHistork[]
  query: string
  setQuery: (v: string) => void
}) {
  const count = props.onetimePayments.length
  const receivedUsdc = useMemo(() => sumUsdc(props.onetimePayments), [props.onetimePayments])

  return (
    <div className="px-4 pt-1.5 pb-4">
      {/* <div className="text-[14px] font-semibold text-slate-500">Invoices · One-time</div> */}

      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <StatCard
          title="Count"
          big={<div className="text-[24px] leading-none font-extrabold">{count}</div>}
        />

        <StatCard
          title="Received"
          big={<div className="text-[20px] leading-none font-extrabold">{formatUsdc4(receivedUsdc)}</div>}
          sub={<div className="text-[12px] font-medium text-slate-500">USDC</div>}
        />

       
      </div>

      <SearchBar value={props.query} onChange={props.setQuery} placeholder="Search payer" />
    </div>
  )
}
