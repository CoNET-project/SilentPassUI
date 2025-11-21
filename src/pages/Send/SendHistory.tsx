import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react"
import { beamioConet } from "@/utils/constants"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from "ethers"
import send_icon from "@/components/assets/send-icon.svg"
import receive_icon from "@/components/assets/receive-icon.svg"

type Payed = {
  payTimestamp: number
  fromAddress: string
  fromBeamioName: string
  payAmount: number
  hash: string
}

type TransferHistork = {
  date: number
  amount: number
  to: string
  hash: string
  from: string
}

type HistoryTableProps = {
	balance: number
}

const fmtAddr = (a = "") => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

type Transfer = {
  to: string
  timestamp: bigint
  from: string
  amount: string
  finisedHash: string
}

const formatTime = (ts: number) => {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleString()
}


// 用 forwardRef 包装
export const SendHistoryTable = (
  ({balance}:HistoryTableProps) => {
    const [items, setItems] = useState<TransferHistork[]>([])
    const [myAddress, setMyAddress] = useState("")
    const { profiles } = useDaemonContext()

    const isSend = (item: TransferHistork) => {
      if (!myAddress) return false
      return item.from.toLowerCase() === myAddress
    }



	const getNewitems = async () => {
		    if (!profiles?.length) return
		const profile: any = profiles[0]   // 这里用你实际的 profile 类型替换 any
		const address = profile.keyID
		console.log(`getAllHistory called, balance = ${balance}`)
		setMyAddress(address.toLowerCase())
		try {
			const [, _links] = await beamioConet.getTransferHistory(address, 0, 100)
			const links: Transfer[] = _links

			const mapped: TransferHistork[] = links.map(n => ({
				date: Number(n.timestamp * BigInt(1000)),
				amount: Number(ethers.formatUnits(n.amount, 6)),
				to: n.to,
				hash: n.finisedHash,
				from: n.from,
			}))

			setItems(mapped.reverse())
		} catch (ex: any) {
			console.log(ex.message)
		}
	}

    // ⭐ 用 useCallback，这样 refresh 一直是同一个函数


    // 初始化时拉一次
    useEffect(() => {
    	setTimeout(() => {
			getNewitems()
		}, 4000)
    }, [balance])

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
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200/70 dark:border-white/10 sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
              <tr className="text-slate-500 dark:text-slate-400">
                <th className="text-left font-normal px-3 py-2">Transaction</th>
                <th className="text-right font-normal px-3 py-2">Value</th>
                <th className="text-center font-normal px-3 py-2">Account</th>
                <th className="text-right font-normal px-3 py-2">Date</th>
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
                const isPaid = !!item.hash
                const txUrl = isPaid ? `https://basescan.org/tx/${item.hash}` : undefined

                return (
                  <tr
                    key={idx}
                    role={txUrl ? "button" : undefined}
                    onClick={() => {
                      if (!txUrl) return
                      window.open(txUrl, "_blank", "noopener,noreferrer")
                    }}
                    className={`
                      group
                      border-t border-slate-100/80 dark:border-white/5
                      hover:bg-slate-50/70 dark:hover:bg-white/5
                      transition
                      ${txUrl ? "cursor-pointer" : "cursor-default"}
                    `}
                  >
                    {/* 第一列：Tag pill / icon 自己看需要是否加回 */}
                    <td className="px-3 py-1 align-middle text-left w-0">
                      <div className="flex items-center gap-2">
                        {/* 如果之后要把 icon 打开，把注释去掉 */}
                        {/* <img
                          src={isSend(item) ? send_icon : receive_icon}
                          alt=""
                          className="w-5 h-5 opacity-90 dark:opacity-90 transform transition-transform duration-150 group-hover:scale-105"
                        /> */}

                        <span
                          className={`
                            text-[10px] font-medium px-2 py-0.5 rounded-full
                            ${
                              isSend(item)
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                            }
                          `}
                        >
                          {isSend(item) ? "Send" : "Receive"}
                        </span>
                      </div>
                    </td>

                    {/* 金额 */}
                    <td className="px-3 py-1 align-middle text-right">
                      <div className="text-[11px] font-medium text-slate-900 dark:text-slate-50">
                        {isSend(item)
                          ? "- " + item.amount.toFixed(2)
                          : item.amount.toFixed(2)}
                      </div>
                    </td>

                    {/* 地址 */}
                    <td className="px-3 py-1 align-middle text-center">
                      <div className="text-[11px] text-slate-700 dark:text-slate-100 truncate max-w-[140px]">
                        {fmtAddr(item.to)}
                      </div>
                    </td>

                    {/* 时间 */}
                    <td className="px-3 py-1 align-middle text-right">
                      <div className="text-[11px] text-slate-700 dark:text-slate-100">
                        {formatTime(item.date)}
                      </div>
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
)
