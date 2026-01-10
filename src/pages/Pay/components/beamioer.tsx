
type Prof = {
	item: searchResult|undefined
}


const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
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


const BeamioDetail = ({item}: Prof) => {
	if (item === undefined) return (<></>)
	return (
		<div
			className="
				w-full flex items-center
				px-3 py-2.5
				text-left
				rounded-2xl
				bg-sky-50
				hover:bg-sky-100
				active:scale-[0.99]
				transition
				relative
			"
			onClick={() => {}}
		>

			

			{/* 头像 */}
			{item.image ? (
				<img
					src={item.image}
					alt={item.username}
					className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0"
				/>
			) : (
				<img
					src={getImg(item.username)}
					alt={item.username}
					className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0 bg-sky-200"
				/>
			)}

			{/* 中间 + 右侧整体 */}
			<div className="flex-1 flex items-start justify-between gap-3 min-w-0 pr-7">
				{/* 左侧文本 */}
				<div className="flex flex-col min-w-0">
					<span className="text-[13px] font-medium text-slate-900 truncate">
						{displayName(item)}
					</span>

					<span className="text-[11px] text-slate-600 truncate">
						@{item.username} · {shortAddress(item.address)}
					</span>

					{/* <span className="text-[11px] text-slate-500 mt-0.5 truncate">
						{Number(item.follow_count || '0').toLocaleString()} following ·{' '}
						{Number(item.follower_count || '0').toLocaleString()} followers
					</span> */}
				</div>

				{/* 右侧日期 */}
				{/* <span className="text-[10px] text-slate-400 whitespace-nowrap">
					{formatUserDate(item.created_at)}
				</span> */}
			</div>
		</div>
	)
}

export default BeamioDetail