
type Prof = {
	item: searchResult
	currencyText: string
	usdcAmount: string
}


const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

// base64 → Blob → objectURL（iOS 更稳）
function dataUrlToObjectUrl(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",")
  const mime = meta.match(/:(.*?);/)?.[1] || "image/webp"
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([arr], { type: mime }))
}

const displayName = (item: searchResult) => {
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

function formatUserDate(timestamp?: string | number): string {
	if (!timestamp) return ""  // 无日期 → 空

	const num = Number(timestamp)
	if (!num) return ""        // 防止 NaN

	// 判断是秒还是毫秒（简易方式）
	const ms = num < 10_000_000_000 ? num * 1000 : num

	const d = new Date(ms)
	if (isNaN(d.getTime())) return ""  // 避免 Invalid Date

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric"
	})
}


const BeamioDetailShow = ({ item, currencyText, usdcAmount }: Prof) => {
	if (item === null) return null

	return (
		<div
			className="
				w-full
				min-w-[360px]
				relative
				flex flex-col
				items-center
				px-3
				py-2.5
				pt-10
				text-left
				rounded-2xl
				bg-sky-50/10
				active:scale-[0.99]
				transition
				border border-white/20
			"
			onClick={() => {}}
		>
			{/* 头像：水平居中 + 上半圆悬浮 */}
			<img
				src={item.image || getImg(item.image)}
				alt={item.username}
				className="
					absolute
					left-1/2
					top-0
					-translate-x-1/2
					-translate-y-1/2
					w-16 h-16
					rounded-full
					object-cover
					bg-sky-200
					ring-2 ring-white
				"
			/>

			{/* 姓名 */}
			<div className="w-full flex flex-col items-center gap-0.5 min-w-0">
				<span
					className="
						max-w-[420px] w-full
						text-[13px] font-medium
						text-white
						truncate text-center
						drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]
					"
				>
					{displayName(item)}
				</span>

				{/*
				<span
					className="
						max-w-[420px] w-full
						text-[11px]
						text-white/85
						truncate text-center
						drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]
					"
				>
					{formatUserDate(item.createdAt)}
				</span>
				*/}
			</div>

			{/* 金额 */}
				<div className="w-full flex flex-col items-center mt-6">
				{/* 外层负责居中 + 横向裁切 */}
				<div className="max-w-[420px] w-full overflow-hidden">
					{/* 内层负责文字渲染（不要 truncate） */}
					<span
					className="
						block w-full
						text-[36px] font-medium
						text-white
						text-center
						tabular-nums
						whitespace-nowrap
						leading-[1.15]
						py-1
						drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]
					"
					>
					{currencyText}
					</span>
				</div>

				<div className="max-w-[420px] w-full overflow-hidden">
					<span
					className="
						block w-full
						text-[11px]
						text-white/85
						text-center
						whitespace-nowrap
						leading-[1.2]
						py-[2px]
						drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]
					"
					>
					{usdcAmount} USDC
					</span>
				</div>
				</div>
		</div>
	)
}

export default BeamioDetailShow