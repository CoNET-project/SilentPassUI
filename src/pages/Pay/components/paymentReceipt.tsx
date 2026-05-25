import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Share2,
  Download,
} from "lucide-react"
import { CURRENCY_META, formatAmount, fiatPrefix } from "@/services/currency"
import NetworkFeeGas from "./networkFee"
import { openExternalUrl } from "@/utils/cashTreesNativeNfc"

type PaymentReceiptProps = {
  open: boolean
  onClose: () => void
  data: TransferHistork
  fromBeamio: searchResult
  onShare?: (tx: TransferHistork) => void
  onPdf?: (tx: TransferHistork) => void
  onChat?: (tx: TransferHistork) => void
  sponsored?: boolean
  networkFeeText?: string
  explorerBaseUrl?: string
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
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `${date} · ${time}`
}

function receiptIdFromHash(hash: string) {
  const clean = (hash || "").replace(/^0x/i, "").toUpperCase()
  const a = clean.slice(0, 4) || "0000"
  const b = clean.slice(4, 8) || "0000"
  return `BMIO-${a}-${b}`
}

function Row(props: { label: string; value: React.ReactNode; meta?: string }) {
  const { label, value, meta } = props
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[16px] font-semibold text-slate-900 leading-snug">{label}</div>
        {!!meta && <div className="mt-0.5 text-[13px] text-slate-500 leading-snug">{meta}</div>}
      </div>

      <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-snug">
        {value}
      </div>
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
        "flex-1 h-[46px]",
        "rounded-[16px]",
        "bg-white",
        "ring-1 ring-black/5",
        "shadow-sm",
        "font-extrabold text-[16px] text-slate-900",
        "flex items-center justify-center gap-2",
        "active:scale-[0.99] transition",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  )
}

const displayName = (item: searchResult | undefined) => {
  if (!item) return ""
  const lastname = item?.last_name?.split("\r\n") || []
  const fullName = `${item?.first_name || ""} ${/^\{/.test(lastname[0]) ? "" : lastname[0] || ""}`.trim()
  return fullName || item.username || item.address
}

export default function PaymentReceipt({
	open,
	data,
	onShare,
	onPdf,
	fromBeamio,
	explorerBaseUrl = "https://basescan.org/tx/",
}: PaymentReceiptProps) {
  const [copied, setCopied] = useState<null | "receipt" | "hash">(null)

  const d = data?.requestDetail
  const currency: ICurrency = d?.requestCurrency || data?.requestCurrency || "USDC"
  const symbol = CURRENCY_META[currency]?.symbol ?? (currency === "USDC" ? "" : "$")

  const totalCurrency = d ? d.totalPayCurrency : currency === "USDC" ? data.preAmount : data.amount
  const totalUsdc = d ? d.totalPayUSDC : data.preAmount
  const rate = d?.rate
  const tax = d ? d?.taxCurrency : 0
	const fiatText = useMemo(() => {
		return fiatPrefix (currency)
	},[currency])

  const receivedCurrency = d ? (d.receivedCurrency - (d.taxCurrency||0)) : 0
  const tipCurrency = d ? d.currencyTip : 0
  const feeCurrency = 0// d ? d.feeCurrency : data.fee

  const totalLineSub = useMemo(() => {
    const left = `≈ ${usdc(totalUsdc)} USDC`
    const right = '' //rate ? `Rate ${rate.toFixed(4)}` : ""
    return right ? `${left} • ${right}` : left
  }, [totalUsdc, rate])

  const merchantName = useMemo(() => displayName(fromBeamio), [fromBeamio])

  const merchantLine = useMemo(() => {
    return ` ${shortAddr(data.address)}`
  }, [data.address])

  const datetimeText = useMemo(() => formatDateTime(data.date), [data.date])
  const usdcToFiatRate = useMemo(() => {
	const d = data?.requestDetail
	if (!d || !d?.rate) return ''
	return `1 USDC = ${symbol} ${formatAmount(d.rate, currency)}`
  }, [data?.requestDetail])

  const receiptId = useMemo(() => d?.code||'', [data.hash])
  const txHashShort = useMemo(() => shortHash(data.hash), [data.hash])

  const explorerUrl = useMemo(
    () => (data.hash ? `${explorerBaseUrl}${data.hash}` : ""),
    [explorerBaseUrl, data.hash])



  const title = useMemo(() => {
	if (!d) return ''
	return d?.title
  }, [d])

  const note = useMemo(() => {
	if (!d) return ''
	return d?.textNote
  }, [d])

    const isInfoNeedOpen = useMemo(() => {
		return !!title || !!note
	}, [title, note])


  return (
    
      <div className="px-4 pb-4 overflow-y-auto">
        {/* top card */}
        <div className="mt-3 rounded-[18px] border border-slate-200/70 bg-white overflow-hidden mb-6">
          <div className="px-4 pt-4 pb-3">
			<div className="text-[18px] font-extrabold text-slate-900 leading-[1.15] truncate mb-6">
				From:
			</div>
            <div className="flex items-start justify-between gap-3">
				
              <div className="min-w-0">
				<div className="text-[18px] font-extrabold text-slate-900 leading-[1.15] truncate">
					{merchantName}
				</div>

				<div className="mt-[1px] text-[12px] text-slate-500 leading-[1.25]">
					@{fromBeamio.username} {merchantLine}
				</div>
				</div>

              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200 text-emerald-700 font-semibold text-[13px]">
                  <CheckCircle2 className="h-4 w-4" />
                  Successed
                </span>
              </div>
            </div>


			{(!!datetimeText || usdcToFiatRate) && (
				<div className="mt-2 flex items-center text-[13px] text-slate-500 leading-[1.25]">
					{/* 左：时间 */}
					<div className="min-w-0 truncate">
					{datetimeText}
					</div>

					{/* 右：汇率（贴最右） */}
					{usdcToFiatRate && (
					<div className="ml-auto flex-shrink-0 text-right tabular-nums text-[rgba(22,82,240,0.65)]">
						{usdcToFiatRate}
					</div>
					)}
				</div>
				)}

            <div className="mt-1 rounded-[14px] border border-slate-200/70 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] text-slate-500">Total</div>

                <div className="text-right">
                  <div className="text-[34px] font-extrabold tracking-tight text-slate-900 leading-none">
                    {currency === "USDC" ? (
                      <>
                        {money(totalCurrency, 2)} <span className="text-[16px] font-extrabold">USDC</span>
                      </>
                    ) : (
                      <>
                        {fiatText} {formatAmount(totalCurrency, currency)}
                      </>
                    )}
                  </div>

                  <div className="mt-1 text-[13px] text-slate-500">{totalLineSub}</div>
                </div>
              </div>
            </div>


          </div>

					{
						title && (
							
								<div className="px-4 pt-4 pb-3">
									<div className="text-[16px] font-extrabold text-slate-900">{title}</div>
								</div>

							
						)
					}

					
										
										{
											note && 
												<div className="px-4 pb-4">
													<div
														className="
														rounded-2xl
														bg-yellow-50/60
														backdrop-blur-sm
														ring-1 ring-yellow-200/40
														px-4 py-3
														"
													>
														<div className="flex items-start gap-2 text-[14px] leading-relaxed">
														<span className="shrink-0 text-yellow-700/60 font-medium">
															Note
														</span>

														<span className="text-slate-700 break-words">
															{note}
														</span>
														</div>
													</div>
												</div>
										}
										
									

		  

		  

          {/* breakdown */}
          <div className="border-t border-slate-100">
            <Row
				label="Subtotal"
				value={
					<div className="flex flex-col items-end">
					<div>
						{currency === "USDC"
						? `${money(receivedCurrency, 4)} USDC`
						: `${fiatText}${formatAmount(receivedCurrency, currency)}`}
					</div>

					{currency !== "USDC" && d?.receivedUSDC && (
						<div className="mt-0.5 text-[11px] text-slate-400">
						≈ {money((d.receivedUSDC - (d.taxUSDC||0)), 2)} USDC
						</div>
					)}
					</div>
				}
				
			/>
            <Divider />

            {isFinite(tipCurrency) && tipCurrency > 0 ? (
              <>
                <Row
					label="Tip"
					value={
						<div className="flex flex-col items-end">
						<div>
							{currency === "USDC"
							? `${money(tipCurrency, 2)} USDC`
							: `${fiatText} ${formatAmount(tipCurrency, currency)}`}
						</div>

						{currency !== "USDC" && d?.USDCTip && (
							<div className="mt-0.5 text-[11px] text-slate-400">
							≈ {money(d.USDCTip, 2)} USDC
							</div>
						)}
						</div>
					}
					meta="Calculated on subtotal (pre-tax)"
				/>
                <Divider />
              </>
            ) : null}

            {isFinite(feeCurrency) && feeCurrency > 0 ? (
              <>
                <Row
                  label="Fee"
                  value={currency === "USDC" ? `${money(feeCurrency, 2)} USDC` : `${fiatText}${formatAmount(feeCurrency, currency)}`}
                  meta="Beamio service fee"
                />
                <Divider />
              </>
            ) : null}

			 <Row
					label="Tax"
					value={
						<div className="flex flex-col items-end">
						<div>
							{currency === "USDC"
							? `${money(d?.taxUSDC||0, 2)} USDC`
							: `${fiatText}${formatAmount(d?.taxCurrency||0, currency)}`}
						</div>

						{currency !== "USDC" && (
							<div className="mt-0.5 text-[11px] text-slate-400">
							≈ {money(d?.taxUSDC||0)} USDC
							</div>
						)}
						</div>
					}
				/>
				<Divider />


            <NetworkFeeGas Credits={true} />
          </div>
        </div>

    
        
		{
			// receipt id	
			receiptId && <>
				<div className="px-4 pt-4 pb-3">
					<div className="text-[16px] font-extrabold text-slate-900">Receipt ID</div>
				</div>

				<div className="px-4 pb-4">
					<div className="rounded-[14px] border border-slate-200/70 bg-white px-4 py-3 flex items-center justify-between gap-3">
					<div className="text-[16px] font-extrabold tracking-wide text-slate-900">{receiptId}</div>

					<button
						type="button"
						onClick={async () => {
						try {
							await navigator.clipboard.writeText(receiptId)
							setCopied("receipt")
							window.setTimeout(() => setCopied(null), 900)
						} catch {}
						}}
						className="h-10 w-10 rounded-2xl bg-white ring-1 ring-black/5 flex items-center justify-center text-slate-700 active:scale-[0.98] transition"
						aria-label="Copy receipt id"
						title={copied === "receipt" ? "Copied" : "Copy"}
					>
						<Copy className="h-5 w-5" />
					</button>
					</div>
				</div>
		
			</>
		}
         

          {/* transaction */}
          
            <div className="text-[16px] font-extrabold text-slate-900 mb-2">Transaction</div>

            <div className="rounded-[14px] border border-slate-200/70 bg-white overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-[14px] font-semibold text-slate-700">Tx hash</div>

                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-extrabold text-slate-900 tabular-nums">{txHashShort || "—"}</div>

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
                    <Copy className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-[14px] font-semibold text-slate-700">Explorer</div>

                {explorerUrl ? (
                  <button
                    type="button"
                    onClick={() => openExternalUrl(explorerUrl)}
                    className="inline-flex items-center gap-2 text-[14px] font-extrabold text-blue-600 hover:text-blue-700"
                  >
                    View on Basescan
                    <ExternalLink className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-[14px] text-slate-400">—</span>
                )}
              </div>
            </div>
          
        

        {/* footer actions */}
        <div className="mt-3 flex items-center gap-3">
          <ActionBtn icon={<Share2 className="h-5 w-5" />} label="Share" onClick={() => onShare?.(data)} />
          <ActionBtn icon={<Download className="h-5 w-5" />} label="Save" onClick={() => onPdf?.(data)} />
        </div>

        <div className="mt-4 pb-1 text-center text-[13px] text-slate-400">
          Receipts are your relationship thread: proof, context, and follow-up.
        </div>
      </div>
    
  )
}
