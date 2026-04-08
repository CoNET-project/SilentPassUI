import React, { useEffect, useState } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { getCardsOfOwnerWithDetailsForProfile, getLatest20UserActions_Lite } from '@/services/BeamioCard'
import { Minus, Plus } from 'lucide-react'
import { fiatPrefix, formatAmount } from '@/services/currency'
import { USDCContract_BASE } from '@/utils/constants'

/** action 枚举：1=mint(收入), 2=burn, 3=transfer(支出) */
const TOKEN_MINT = 1

/** 格式化时间戳为 "Jan 31 • 04:59 p.m." */
function formatTimestamp(ts: number): string {
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (!isFinite(d.getTime())) return ''
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 || 12
  const time = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
  return `${month} ${day} • ${time}`
}

/** 根据 payMe 或 item 生成展示用金额字符串（用户发行的 BeamioUserCard 活动；无 CCSA / 基础设施卡特例）。 */
function formatAmountText(item: BeamioActionResponse, isCredit: boolean): string {
  const pm = item.payMe
  const sign = isCredit ? '+' : '-'
  const currency: ICurrency = pm?.currency || 'USDC'

  if (pm?.currencyAmount != null && pm?.currencyAmount !== '') {
    const amount = formatAmount(pm.currencyAmount, currency)
    const prefix = fiatPrefix(currency) || '$'
    return `${sign}${prefix} ${amount}`
  }
  const formatted = formatAmount(item.amount, 'USDC')
  return `${sign}$ ${formatted}`
}

type ActionItemProps = {
  item: BeamioActionResponse
  onItemClick?: (item: BeamioActionResponse) => void
}

function ActionItem({ item, onItemClick }: ActionItemProps) {
  const { profiles } = useDaemonContext()
  // 判断受益人是自己：检查 to 地址是否匹配当前用户的 EOA 或 AA 账号
  const currentUserEOA = profiles?.[0]?.keyID?.toLowerCase()
  const currentUserAA = profiles?.[0]?.aaAccount?.toLowerCase()
  const itemToLower = item.to?.toLowerCase()
  const isBeneficiary = itemToLower && (itemToLower === currentUserEOA || itemToLower === currentUserAA)
  
  // 如果受益人是自己，显示 +；否则根据 actionType 判断（TOKEN_MINT = 收入）
  const isCredit = isBeneficiary || Number(item.action) === TOKEN_MINT
  const title = item.payMe?.title ?? item.title
  const amountText = formatAmountText(item, isCredit)

  return (
    <button
      type="button"
      onClick={() => onItemClick?.(item)}
      className="
        w-full text-left
        flex items-center gap-3
        rounded-2xl bg-white
        shadow-[0_10px_26px_rgba(15,23,42,0.08)]
        ring-1 ring-black/5
        px-4 py-3
        transition active:scale-[0.99]
      "
    >
      {/* 左侧图标 */}
      <div
        className={`
          shrink-0 w-11 h-11 rounded-full flex items-center justify-center
          ${isCredit ? 'bg-emerald-100 ring-1 ring-emerald-200/60' : 'bg-amber-50 ring-1 ring-amber-200/60'}
        `}
      >
        {isCredit ? (
          <Plus className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <Minus className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
        )}
      </div>

      {/* 中间：标题 + 时间（优先使用 payMe 数据） */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-slate-900 truncate">
          {title || (isCredit ? 'Membership' : 'Purchase')}
        </div>
        <div className="text-[13px] text-slate-500 mt-0.5">
          {formatTimestamp(item.timestamp)}
        </div>
      </div>

      {/* 右侧金额 */}
      <div
        className={`
          shrink-0 text-[15px] font-semibold tabular-nums
          ${isCredit ? 'text-emerald-600' : 'text-slate-900'}
        `}
      >
        {amountText}
      </div>
    </button>
  )
}

type ActiveListProps = {
  onItemClick?: (item: BeamioActionResponse) => void
  MyCardAssets: MyCardAssets
}

const ActiveList = ({ onItemClick, MyCardAssets }: ActiveListProps) => {
  const { profiles } = useDaemonContext()
  const [actions, setActions] = useState<BeamioActionResponse[]>([])

  useEffect(() => {
    if (!profiles?.[0] || !MyCardAssets?.cardAddress) return
    let cancelled = false
    void (async () => {
      try {
        const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(profiles[0])
        const seen = new Set<string>()
        const programAddrs: string[] = []
        if (trusted && cards.length > 0) {
          for (const c of cards) {
            const k = c.cardAddress.toLowerCase()
            if (seen.has(k)) continue
            seen.add(k)
            programAddrs.push(c.cardAddress)
          }
        } else {
          programAddrs.push(MyCardAssets.cardAddress)
        }
        const [usdcActions, ...assetActions] = await Promise.all([
          getLatest20UserActions_Lite(profiles[0], USDCContract_BASE),
          ...programAddrs.map((cardAddr) =>
            getLatest20UserActions_Lite(profiles[0], cardAddr, MyCardAssets.cardAddress),
          ),
        ])
        if (cancelled) return
        const allActions = [...(usdcActions || []), ...assetActions.flat()]
        allActions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        setActions(allActions.slice(0, 20))
      } catch (error) {
        if (!cancelled) {
          console.warn('[ActiveList] Failed to load actions:', error)
          setActions([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profiles, MyCardAssets?.cardAddress])

  return (
    <div className="space-y-3 mt-4 pb-8">
      {actions.length === 0 ? (
        <div className="rounded-2xl bg-white/80 shadow-[0_10px_26px_rgba(15,23,42,0.06)] px-4 py-6 text-center text-[14px] text-slate-500">
          No activity yet
        </div>
      ) : (
        actions.map((item, index) => (
          <ActionItem
            key={`${item.cardAddress}-${item.timestamp}-${index}`}
            item={item}
            onItemClick={onItemClick}
          />
        ))
      )}
    </div>
  )
}

export default ActiveList