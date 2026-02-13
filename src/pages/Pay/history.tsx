import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {ethers} from 'ethers'
type Payed = {
  payTimestamp: number
  fromAddress: string
  fromBeamioName: string
  payAmount: number
  hash: string
}

type LinkHistork = {
  issueTimestamp: number
  amount: number
  note: string
  hash: string
  payed: null | Payed
}

type HistoryTableProps = {
	itemClock: (item: LinkHistork) => void
}



type links = {
	to: string
    successAuthorizationHash: string
    chianID: string
    erc3009Address: string
    node: string
    amount: bigint
    decimals: bigint
    issueTimestamp: bigint
    payHash: string
    payTimestamp: bigint
    from: string
    payAmount: string
}

const formatNote = (note: string) => {
	if (!note) return ''
	if (note.length <= 10) return note
	return note.slice(0, 10) + '…'
}

const formatTime = (ts: number) => {
	if (!ts) return '—'
	const d = new Date(ts)
	return d.toLocaleString()
}


export const LinkHistoryTable: React.FC<HistoryTableProps> = ({itemClock}: HistoryTableProps) => {
  const [items, setItems] = useState<LinkHistork[]>([])
  const { profiles } = useDaemonContext()

  const getAllHistory = async () => {
    if (!profiles?.length) return
    const profile: profile = profiles[0]
    const address = profile.keyID

    try {
      // 旧合约 getLinksHistory 已停用
      const [linkHashes, _links] = [[], []] as [string[], links[]]
      const links: links[] = _links

      const mapped: LinkHistork[] = links.map(n => ({
			issueTimestamp: Number(n.issueTimestamp * BigInt(1000)),
			amount: Number(ethers.formatUnits(n.amount, 6)),
			note: n.node,
			payed: null,
			hash: n.payHash
      }))

      setItems(mapped.reverse())
    } catch (ex: any) {
      console.log(ex.message)
    }
  }

  useEffect(() => {
    getAllHistory()
  }, [])

  return (
		<div
			className="
				w-full h-full                     /* ⭐ 吃掉父容器高度 */
				rounded-2xl border border-slate-200/70 dark:border-white/10
				bg-transparent
				text-sm
				flex flex-col                      /* ⭐ 内部继续用 flex */
				min-h-0                            /* ⭐ 允许被压缩，否则 iOS 会硬撑 */
				overflow-hidden
		"
		>
			{/* Filter row */}
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 rounded-full bg-slate-900 text-white font-medium">
                All
              </button>
              <button className="px-2 py-1 rounded-full bg-white text-slate-600 border border-slate-200">
                Send
              </button>
              <button className="px-2 py-1 rounded-full bg-white text-slate-600 border border-slate-200">
                Receive
              </button>
              <button className="px-2 py-1 rounded-full bg-white text-slate-600 border border-slate-200">
                Pending
              </button>
            </div>
            <button className="text-slate-400">Sort · Newest</button>
          </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-slate-200/70 dark:border-white/10 sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
            <tr className="text-slate-500 dark:text-slate-400">
              <th className="text-left font-normal px-3 py-2">Created</th>
              <th className="text-right font-normal px-3 py-2">Amount</th>
              <th className="text-left font-normal px-3 py-2">Note</th>
              <th className="text-right font-normal px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-slate-400 dark:text-slate-500"
                >
                  No history yet
                </td>
              </tr>
            )}

            {items.map((item, idx) => {
              const isPaid = !!item.payed

              return (
					<tr
						key={idx}
						onClick={() => itemClock(item)}        // ← 点击整行触发
						className="
							border-t border-slate-100/80 dark:border-white/5
							hover:bg-slate-50/70 dark:hover:bg-white/5
							transition
							cursor-pointer                      // ← 鼠标手型
					"
					>
                  <td className="px-3 py-2 align-middle">
                    <div className="text-[11px] text-slate-700 dark:text-slate-100">
                      {formatTime(item.issueTimestamp)}
                    </div>
                  </td>

                  <td className="px-3 py-2 align-middle text-right">
                    <div className="text-[11px] font-medium text-slate-900 dark:text-slate-50">
                      {item.amount.toFixed(2)}
                    </div>
                  </td>

                  <td className="px-3 py-2 align-middle">
                    <div className="text-[11px] text-slate-700 dark:text-slate-100 truncate max-w-[140px]">
                      {formatNote(item.note)}
                    </div>
                  </td>

                  <td className="px-3 py-2 align-middle text-right">
                    <span
                      className={`
                        inline-flex items-center justify-end
                        rounded-full px-2 py-0.5 text-[10px] font-medium
                        ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }
                      `}
                    >
                      {isPaid ? "Paid" : "Pending"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}