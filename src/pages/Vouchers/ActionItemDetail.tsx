import React, { useState } from 'react'
import { Link2, Layers, Copy, X } from 'lucide-react'
import { fiatPrefix, formatAmount } from '@/services/currency'
import { CCSA_Card_Address } from '@/utils/constants'

const TOKEN_MINT = 1

function formatDateShort(ts: number): string {
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (!isFinite(d.getTime())) return ''
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  return `${month} ${day}`
}

function isCCSACard(cardAddress: string): boolean {
  if (!cardAddress || !CCSA_Card_Address) return false
  return cardAddress.toLowerCase() === CCSA_Card_Address.toLowerCase()
}

/** 总支付金额（法币）：如 CA$100.00 */
function totalPaidFiat(item: BeamioActionResponse): string {
  const pm = item.payMe
  const currency: ICurrency = pm?.currency || 'USDC'
  const amount =
    pm?.currencyAmount != null && pm?.currencyAmount !== ''
      ? formatAmount(pm.currencyAmount, currency)
      : formatAmount(item.amount, 'USDC')
  const prefix = fiatPrefix(currency) || '$'
  return `${prefix}${amount}`
}

/** 总支付 USDC 数量：payMe.usdcAmount 为转换为 USDC 的金额 */
function totalPaidUsdc(item: BeamioActionResponse): string {
  const pm = item.payMe
  const raw = pm?.usdcAmount != null ? String(pm.usdcAmount) : item.amount
  return formatAmount(raw, 'USDC') + ' USDC'
}

/** USDC 常用 6 位小数，若数值很大则视为 raw 需除以 1e6 */
const USDC_DECIMALS = 6
function toUsdcHuman(raw: number): number {
  if (!Number.isFinite(raw)) return raw
  if (raw >= 1e5 || (raw > 0 && raw === Math.floor(raw) && raw < 1e15)) {
    const scaled = raw / 10 ** USDC_DECIMALS
    if (scaled >= 0.0001 && scaled < 1e9) return scaled
  }
  return raw
}

/**
 * 汇率文案：1 {currency} ≈ x USDC
 * currencyAmount = 该币种的实际金额（如 100 CAD），usdcAmount = 换算后的 USDC 金额（如 73.85），
 * 汇率 = usdcAmount / currencyAmount → 1 CAD ≈ 0.7385 USDC
 * 注意：usdcAmount 若为链上 raw（6 位小数）会自动除以 1e6；mint 时 item.amount 是 $CCSA 点数不能当 USDC 用
 */
function exchangeRateText(item: BeamioActionResponse): string {
  const pm = item.payMe
  const currencyNum = pm?.currencyAmount != null && pm.currencyAmount !== ''
    ? Number(pm.currencyAmount)
    : NaN
  const usdcRaw = pm?.usdcAmount != null ? Number(pm.usdcAmount) : NaN
  const usdcNum = Number.isFinite(usdcRaw) ? toUsdcHuman(usdcRaw) : NaN
  if (!Number.isFinite(currencyNum) || !Number.isFinite(usdcNum) || currencyNum <= 0) {
    return '1 USDC ≈ 1 USDC'
  }
  const c = (pm?.currency || 'USDC') as ICurrency
  if (c === 'USDC') return '1 USDC ≈ 1 USDC'
  const usdcPerUnit = usdcNum / currencyNum
  const sym = c === 'CAD' ? 'CAD' : c === 'USD' ? 'USD' : c
  return `1 ${sym} ≈ ${usdcPerUnit.toFixed(4)} USDC`
}

/** 交易参考号（无真实 ref 时用时间戳生成简短号） */
function refAndDate(item: BeamioActionResponse): string {
  const ref = 'TXN-' + String(Math.abs(item.timestamp) % 100000).padStart(3, '0')
  return `${ref} • ${formatDateShort(item.timestamp)}`
}

/** 完整交易 ID（用于 BaseScan 链接与复制），优先 depositHash / parentHash */
function fullTxId(item: BeamioActionResponse): string | null {
  const hash = item.payMe?.depositHash || item.payMe?.parentHash
  if (hash && typeof hash === 'string' && hash.length > 0) return hash
  return null
}

/** 交易 ID 展示文案（截断） */
function txIdDisplay(item: BeamioActionResponse): string {
  const hash = fullTxId(item)
  if (hash) {
    if (hash.length <= 14) return hash
    return hash.slice(0, 6) + '...' + hash.slice(-4)
  }
  const raw = item.cardAddress || ''
  if (!raw || raw.length < 10) return '—'
  return raw.slice(0, 6) + '...' + raw.slice(-4)
}

const BASESCAN_TX_URL = 'https://basescan.org/tx/'

type ActionItemDetailProps = {
  item: BeamioActionResponse
  /** 会员卡号（如 tokenId），用于 In (NFT) 显示 Membership Pass #xxx */
  memberNo?: string
  onClose?: () => void
}

function DetailRow({
  label,
  value,
  labelClassName = 'text-slate-500',
  valueClassName = 'text-slate-900',
}: {
  label: string
  value: React.ReactNode
  labelClassName?: string
  valueClassName?: string
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[13px] ${labelClassName}`}>{label}</span>
      <span className={`text-[14px] font-medium text-right break-all ${valueClassName}`}>
        {value}
      </span>
    </div>
  )
}

export default function ActionItemDetail({ item, memberNo, onClose }: ActionItemDetailProps) {
  const isCredit = Number(item.action) === TOKEN_MINT
  const title = item.payMe?.title ?? item.title ?? (isCredit ? 'CCSA Membership' : 'Purchase')
  const totalFiat = totalPaidFiat(item)
  const totalUsdc = totalPaidUsdc(item)
  const exchangeRate = exchangeRateText(item)
  const refDate = refAndDate(item)
  const txId = txIdDisplay(item)
  const [copied, setCopied] = useState(false)

  const txIdFull = fullTxId(item)
  const handleCopyTxId = () => {
    const full = txIdFull || item.cardAddress || ''
    if (full) {
      navigator.clipboard.writeText(full).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div
      className="w-full max-w-[420px] mx-auto px-4 pb-8 mt-12"
      style={{ paddingTop: '0.5rem' }}
    >
      {/* 主标题与参考号 */}
      <div className="mb-4">
        <h1 className="text-[22px] font-bold text-slate-900">{title}</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">{refDate}</p>
      </div>

      {/* Total Paid */}
      <div className="flex justify-between items-center py-3 border-b border-slate-100">
        <span className="text-[14px] text-slate-600">Total Paid</span>
        <span className="text-[16px] font-semibold text-slate-900">{totalFiat}</span>
      </div>

      {/* Payment Details 卡片：标题与 Total Paid 为亮蓝，Exchange Rate 为灰蓝 */}
      <div className="mt-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/20 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-blue-600" strokeWidth={2} />
          <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">
            Payment Details
          </span>
        </div>
        <DetailRow
          label="Exchange Rate"
          value={exchangeRate}
          labelClassName="text-slate-500"
          valueClassName="text-slate-500"
        />
        <DetailRow
          label="Total Paid in USDC"
          value={totalUsdc}
          labelClassName="text-blue-600 font-bold"
          valueClassName="text-blue-600 font-bold"
        />
      </div>

      {/* Smart Contract Execution 卡片：标题浅灰，Out 标签红/数值黑，In 标签绿/数值黑 */}
      <div className="mt-4 rounded-2xl bg-slate-100/90 dark:bg-slate-800/40 px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-slate-500" strokeWidth={2} />
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            Smart Contract Execution
          </span>
        </div>
        <DetailRow
          label="Out (Payment)"
          value={totalUsdc}
          labelClassName="text-red-600"
          valueClassName="text-slate-900 font-medium"
        />
        <DetailRow
          label="In (Mint)"
          value={`$CCSA ${formatAmount(item.amount, 'USDC')}`}
          labelClassName="text-emerald-600"
          valueClassName="text-slate-900 font-medium"
        />
        
        {isCredit && (
          <DetailRow
            label="In (NFT)"
            value={`Membership Pass #${memberNo ?? '—'}`}
            labelClassName="text-emerald-600"
            valueClassName="text-slate-900 font-medium"
          />
        )}
      </div>

      {/* Network & Transaction ID */}
      <div className="mt-4 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-black/5 px-4 py-4">
        <DetailRow
          label="Network"
          value={
            <span className="inline-flex items-center gap-1.5">
				<span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden />
              Base Mainnet
              
            </span>
          }
        />
        <div className="flex justify-between items-center gap-3">
          <span className="text-[13px] text-slate-500">Transaction ID</span>
          <div className="inline-flex items-center gap-1.5">
            {txIdFull ? (
              <a
                href={`${BASESCAN_TX_URL}${txIdFull}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium text-blue-600 hover:underline"
              >
                {txId}
              </a>
            ) : (
              <span className="text-[14px] font-medium text-slate-900">{txId}</span>
            )}
            <button
              type="button"
              onClick={handleCopyTxId}
              className="p-0.5 text-slate-400 hover:text-slate-600 active:opacity-70"
              aria-label="Copy transaction ID"
            >
              <Copy className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
        {copied && (
          <p className="text-[12px] text-emerald-600 mt-1 text-right">Copied</p>
        )}
      </div>

      {/* Grand Total */}
      <div className="mt-4 rounded-2xl bg-slate-100/90 dark:bg-slate-800/40 px-4 py-5 text-center">
        <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Grand Total Paid
        </p>
        <p className="text-[24px] font-bold text-blue-600">{totalFiat}</p>
      </div>

      {/* Close 按钮 */}
      {/* {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="
            w-full mt-6 flex items-center justify-center gap-2
            rounded-xl bg-white dark:bg-slate-800
            ring-1 ring-slate-200 dark:ring-slate-700
            py-3.5 text-[15px] font-semibold text-slate-800 dark:text-slate-200
            active:scale-[0.99]
          "
        >
          <X className="w-5 h-5" strokeWidth={2} />
          Close
        </button>
      )} */}
    </div>
  )
}
