import { useState, useEffect } from "react"
import SendTabs from "./SendTabs"
import { ethers } from "ethers"
import { Search } from "lucide-react"
import styles from './send.module.scss'

type SendToInputProps = {
  	sendAction: (address: string) => void
	loadingError: string
}

export default function SendToInput({ sendAction, loadingError }: SendToInputProps) {
  const [address, setAddress] = useState("")
  const [addressError, setAddressError] = useState<string | null>(null)

  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<string | null>(null)
const [loading, setLoading] = useState(false)
  const searchAccount = async () => {
    if (!address.startsWith("@")) return

    setSearching(true)
    setSearchResult(null)

    await new Promise(r => setTimeout(r, 800))

    // 无结果则 searchResult 保持 null
    // const resolved = "0x1234567890abcdef1234567890abcdef12345678"
    // setSearchResult(resolved)

    setSearching(false)
  }

  useEffect(() => {
    setSearchResult(null)
    setSearching(false)
  }, [address])

  const validateAddress = () => {
    if (!address) {
      setAddressError("Address is required")
      return false
    }

    if (!address.startsWith("@") && !address.startsWith("0x")) {
      setAddressError("Enter a valid @handle or 0x address")
      return false
    }

    if (address.startsWith("0x")) {
      const ok = ethers.isAddress(address)
      if (!ok) {
        setAddressError("Invalid wallet address")
        return false
      }
    }

    return true
  }

  const onSend = () => {
    if (!validateAddress()) return
	setLoading(true)
    sendAction(address)

  }

  const isValid =
    addressError === null &&
    (
      (address.startsWith("0x") && ethers.isAddress(address)) ||
      (address.startsWith("@") && searchResult && ethers.isAddress(searchResult))
    )

  const showSearch = address.startsWith("@")

  return (
    <div className="relative pb-20 mb-6"> {/* 给底部按钮预留空间 */}
		<div className="px-5">	{/* 、、预留空间 */}
			<div className="text-sm text-sky-400 mb-2">Send to</div>

			<div className="relative">
					<input
					type="text"
					placeholder="Enter @handle or address"
					value={address}
					onChange={e => {
						const v = e.target.value
						setAddress(v)
						if (addressError) setAddressError(null)
					}}
					onBlur={validateAddress}
					className={`
						h-16 w-full rounded-xl px-4 pr-14 text-base

						/* 🔥 透明背景 + 系统继承文字颜色 */
						bg-transparent
						text-inherit
						placeholder:text-current/50

						/* 🔥 基础边框（非 error 时） */
						border
						${addressError ? "border-red-500" : "border-sky-500"}

						/* 🔥 Focus 颜色跟随 error 状态 */
						focus:outline-none
						${addressError
						? "focus:ring-2 focus:ring-red-500"
						: "focus:ring-2 focus:ring-sky-500"}

						transition-colors
					`}
					/>

				{showSearch && (
				<button
					onClick={searchAccount}
					disabled={searching}
					className="
						absolute right-3 top-1/2 -translate-y-1/2
						w-9 h-9 rounded-full
						flex items-center justify-center

						bg-slate-100 dark:bg-slate-800
						border border-slate-300 dark:border-slate-600
						text-slate-500 dark:text-slate-300

						shadow-sm
						active:scale-95 active:bg-slate-200 dark:active:bg-slate-700
						transition
					"
				>
					{searching ? (
					<div className="
						h-4 w-4 rounded-full animate-spin
						border-2 border-slate-300 dark:border-slate-500
						border-t-transparent
					" />
					) : (
					<Search className="w-4 h-4" />
					)}
				</button>
				)}
			</div>

			{addressError && (
				<div className="mt-1 text-xs text-red-400">{addressError}</div>
			)}

			{searchResult && (
				<div className="mt-2 text-xs text-sky-400 font-mono break-all">
				Found: {searchResult}
				</div>
			)}

			<SendTabs />

			{/* 固定到底部 */}
		</div>

      
		<button
			onClick={onSend}
			disabled={loading}
			className={`
			absolute bottom-0 left-0 right-0
			w-full h-12 rounded-xl
			text-white text-sm font-medium
			active:scale-[0.97] transition
			flex items-center justify-center

			${
				loadingError
				? 'bg-red-700 hover:bg-red-700'
				: 'bg-gradient-to-r from-sky-500 to-blue-500'
			}

			${loading ? 'opacity-80 cursor-not-allowed' : ''}
			`}
		>
			{loadingError ? (
			<span className="px-3 text-sm">{loadingError}</span>
			) : loading ? (
			<div className={styles.loadingDots}>
				{Array.from({ length: 5 }).map((_, i) => (
				<span key={i} className={styles.loadingDot} />
				))}
			</div>
			) : (
			'Confirm'
			)}
		</button>
      
    </div>
  )
}
