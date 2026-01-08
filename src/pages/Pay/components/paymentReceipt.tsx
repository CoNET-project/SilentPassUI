import { useMemo, useState } from "react"
import {
  X,
  Receipt as ReceiptIcon,
  CheckCircle2,
  Copy,
  ExternalLink,
  Share2,
  Download,
  MessageCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import {CURRENCY_META} from '@/services/currency'
import NetworkFeeGas from './networkFee'

type PaymentReceiptProps = {
  open: boolean
  onClose: () => void
  data: TransferHistork
	fromBeamio: searchResult
  // optional actions
  onShare?: (tx: TransferHistork) => void
  onPdf?: (tx: TransferHistork) => void
  onChat?: (tx: TransferHistork) => void

  // optional UI flags
  sponsored?: boolean
  networkFeeText?: string // default "0.00"
  explorerBaseUrl?: string // default "https://basescan.org/tx/"
}

function shortHash(h: string, left = 6, right = 4) {
  const s = (h || "").trim()
  if (s.length <= left + right + 2) return s
  return `${s.slice(0, left)}...${s.slice(-right)}`
}

function shortAddr(a: string, left = 6, right = 4) {
  const s = (a || "").trim()
  if (s.length <= left + right + 2) return s
  return `${s.slice(0, left)}...${s.slice(-right)}`
}

function money(n: number, digits = 2) {
  if (!isFinite(n)) return "0.00"
  return n.toFixed(digits)
}

function usdc(n: number, digits = 4) {
  if (!isFinite(n)) return "0"
  return n.toFixed(digits)
}

function formatDateTime(ts: number) {
  const d = new Date(ts)
  if (!isFinite(d.getTime())) return ""
  // e.g. Jan 6, 2026 · 4:07 PM
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${date} · ${time}`
}

function receiptIdFromHash(hash: string) {
  // deterministic, looks like BMIO-7E3A-9C12
  const clean = (hash || "").replace(/^0x/i, "").toUpperCase()
  const a = clean.slice(0, 4) || "0000"
  const b = clean.slice(4, 8) || "0000"
  return `BMIO-${a}-${b}`
}

function Row(props: { label: string; value: React.ReactNode; meta?: string }) {
  const { label, value, meta } = props
  return (
    <div className="px-4 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[18px] font-semibold text-slate-900">{label}</div>
        {!!meta && <div className="mt-1 text-[15px] text-slate-500">{meta}</div>}
      </div>

      <div className="text-[20px] font-extrabold text-slate-900 tabular-nums">{value}</div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-slate-100" />
}

function ActionBtn(props: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  const { icon, label, onClick } = props
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 h-[52px]",
        "rounded-[18px]",
        "bg-white",
        "ring-1 ring-black/5",
        "shadow-sm",
        "font-extrabold text-[18px] text-slate-900",
        "flex items-center justify-center gap-2",
        "active:scale-[0.99] transition",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  )
}

const displayName = (item: searchResult|undefined) => {
	if (!item) return ''
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

export default function PaymentReceipt({
  open,
  onClose,
  data,
  onShare,
  onPdf,
  fromBeamio,
  onChat,
  sponsored = true,
  networkFeeText = "0.00",
  explorerBaseUrl = "https://basescan.org/tx/",
}: PaymentReceiptProps) {
  const [copied, setCopied] = useState<null | "receipt" | "hash">(null)

  const d = data?.requestDetail
  const currency: ICurrency = d?.requestCurrency || data?.requestCurrency || "USDC"
const symbol = CURRENCY_META[currency]?.symbol ?? (currency === "USDC" ? "" : "$")

  // === amounts (prefer requestDetail if exists) ===
  const totalCurrency = d ? d.totalPayCurrency : currency === "USDC" ? data.preAmount : data.amount
  const totalUsdc = d ? d.totalPayUSDC : data.preAmount
  const rate = d?.rate

  // breakdown: we don't have Tax field in your data model,
  // so we show a breakdown that matches what you DO have:
  // Subtotal(Received), Tip, Beamio fee (from requestDetail/fee), Note, Network fee (sponsored)
  const receivedCurrency = d ? d.receivedCurrency : totalCurrency
  const tipCurrency = d ? d.currencyTip : 0
  const feeCurrency = d ? d.feeCurrency : data.fee

  const totalLineSub = useMemo(() => {
    const left = `≈ ${usdc(totalUsdc)} USDC`
    const right = rate ? `Rate ${rate.toFixed(4)}` : ""
    return right ? `${left} • ${right}` : left
  }, [totalUsdc, rate])

 	const merchantName = useMemo(() => displayName(fromBeamio), [fromBeamio])

  const merchantLine = useMemo(() => {
    // match screenshot line style: "@BeamioDemo • 0xdca9...1f74"
    // we only have address now, so keep the dot format but without handle.
    return ` ${shortAddr(data.address)}`
  }, [data.address])

  const datetimeText = useMemo(() => formatDateTime(data.date), [data.date])

  const receiptId = useMemo(() => receiptIdFromHash(data.hash), [data.hash])
  const txHashShort = useMemo(() => shortHash(data.hash), [data.hash])
  const explorerUrl = useMemo(() => (data.hash ? `${explorerBaseUrl}${data.hash}` : ""), [explorerBaseUrl, data.hash])

  if (!open) return null

  return (

      <div
        className={[
			"max-w-[560px]",
			"mx-auto",               // ✅ 关键：左右居中
          "bg-white",

          "border border-slate-200/70",
          "rounded-t-[28px]",
          "shadow-[0_-24px_80px_rgba(0,0,0,0.18)]",
          "overflow-hidden",
          // ✅ 高度不再顶天立地：最多 90svh，内容超出则内部滚动
        //   "max-h-[90svh]",
          "flex flex-col",
        ].join(" ")}
      >
          {/* header */}

          <div className="px-5 pb-5 overflow-y-auto">
            {/* top card */}
            <div className="mt-4 rounded-[20px] border border-slate-200/70 bg-white overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[20px] font-extrabold text-slate-900 leading-tight truncate">{merchantName}</div>

                    <div className="mt-0.5 text-[14px] text-slate-500 truncate">{merchantLine}</div>

                    {!!datetimeText && <div className="mt-1 text-[14px] text-slate-500">{datetimeText}</div>}
                  </div>

                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-200 text-emerald-700 font-semibold text-[14px]">
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmed
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-[16px] border border-slate-200/70 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] text-slate-500">Total</div>

                    <div className="text-right">
                      <div className="text-[40px] font-extrabold tracking-tight text-slate-900 leading-none">
                        {currency === "USDC" ? (
                          <>
                            {money(totalCurrency, 2)} <span className="text-[20px] font-extrabold">USDC</span>
                          </>
                        ) : (
                          <>
                            {symbol}
                            {money(totalCurrency, 2)}
                          </>
                        )}
                      </div>

                      <div className="mt-1 text-[15px] text-slate-500">{totalLineSub}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* breakdown */}
              <div className="border-t border-slate-100">
                <Row
                  label="Subtotal"
                  value={
                    currency === "USDC"
                      ? `${money(receivedCurrency, 2)} USDC`
                      : `${symbol}${money(receivedCurrency, 2)}`
                  }
                />
                <Divider />

                {/* tip (only if exists) */}
                {isFinite(tipCurrency) && tipCurrency > 0 ? (
                  <>
                    <Row
                      label="Tip"
                      value={currency === "USDC" ? `${money(tipCurrency, 2)} USDC` : `${symbol}${money(tipCurrency, 2)}`}
                      meta="Calculated on subtotal (pre-tax)"
                    />
                    <Divider />
                  </>
                ) : null}

                {/* fee (only if exists) */}
                {isFinite(feeCurrency) && feeCurrency > 0 ? (
                  <>
                    <Row
                      label="Fee"
                      value={currency === "USDC" ? `${money(feeCurrency, 2)} USDC` : `${symbol}${money(feeCurrency, 2)}`}
                      meta="Beamio service fee"
                    />
                    <Divider />
                  </>
                ) : null}

                {/* <Row label="Note" value={data.note?.trim() ? data.note : "—"} /> */}
                <Divider />

                <NetworkFeeGas Credits={true} />
              </div>
            </div>

            {/* receipt id */}
            <div className="mt-4 rounded-[20px] border border-slate-200/70 bg-white overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="text-[18px] font-extrabold text-slate-900">Receipt ID</div>
              </div>

              <div className="px-4 pb-4">
                <div className="rounded-[16px] border border-slate-200/70 bg-white px-4 py-4 flex items-center justify-between gap-3">
                  <div className="text-[18px] font-extrabold tracking-wide text-slate-900">{receiptId}</div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(receiptId)
                        setCopied("receipt")
                        window.setTimeout(() => setCopied(null), 900)
                      } catch {}
                    }}
                    className="h-11 w-11 rounded-2xl bg-white ring-1 ring-black/5 flex items-center justify-center text-slate-700 active:scale-[0.98] transition"
                    aria-label="Copy receipt id"
                    title={copied === "receipt" ? "Copied" : "Copy"}
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* transaction */}
              <div className="px-4 pb-4">
                <div className="text-[18px] font-extrabold text-slate-900 mb-3">Transaction</div>

                <div className="rounded-[16px] border border-slate-200/70 bg-white overflow-hidden">
                  <div className="px-4 py-4 flex items-center justify-between gap-3">
                    <div className="text-[16px] font-semibold text-slate-700">Tx hash</div>

                    <div className="flex items-center gap-2">
                      <div className="text-[16px] font-extrabold text-slate-900 tabular-nums">{txHashShort || "—"}</div>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(data.hash || "")
                            setCopied("hash")
                            window.setTimeout(() => setCopied(null), 900)
                          } catch {}
                        }}
                        className="h-9 w-9 rounded-full hover:bg-black/5 active:scale-[0.98] transition flex items-center justify-center"
                        aria-label="Copy tx hash"
                        title={copied === "hash" ? "Copied" : "Copy"}
                      >
                        <Copy className="h-4.5 w-4.5 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-4 py-4 flex items-center justify-between gap-3">
                    <div className="text-[16px] font-semibold text-slate-700">Explorer</div>

                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[16px] font-extrabold text-blue-600 hover:text-blue-700"
                      >
                        View on Basescan
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-[16px] text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* footer actions */}
            <div className="mt-4 flex items-center gap-3">
              <ActionBtn icon={<Share2 className="h-5 w-5" />} label="Share" onClick={() => onShare?.(data)} />
              <ActionBtn icon={<Download className="h-5 w-5" />} label="Save" onClick={() => onPdf?.(data)} />
              
            </div>

            <div className="mt-6 pb-2 text-center text-[14px] text-slate-400">
              Receipts are your relationship thread: proof, context, and follow-up.
            </div>
          </div>
    </div>
      
 
  )
}
