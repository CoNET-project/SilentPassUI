
type Prof = {
	fromBeamio?: searchResult
	note: string
	dateData: string
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}
const SenderBmo = ({fromBeamio, note, dateData}: Prof) => {
	

	const fallback = typeof getImg === 'function' ? getImg(fromBeamio?.image||'') : ''
	return (
			<div
					key={fromBeamio?.username}
					className="
						w-full
						flex items-center gap-1
						
						
						px-2 py-1
						text-left
						hover:bg-slate-100
						active:scale-[0.98]
						transition
					"
				>
					{/* Avatar */}
					<img
						src={fromBeamio?.image || fallback}
						alt={fromBeamio?.username}
						className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-slate-200"
					/>

					{/* 左侧：用户名 / @handle */}
					<span className="flex-1 min-w-0 leading-tight">
						<span className="block text-[12px] text-slate-900 truncate leading-tight">
							{fromBeamio ? displayName(fromBeamio) : ""}
						</span>
						<span className="block text-[10px] text-slate-500 truncate leading-tight">
							@{fromBeamio?.username}
						</span>
						<span className="block text-[10px] text-slate-400 truncate leading-tight">
							{dateData}
						</span>
					</span>

					{/* ✅ 右侧：金额 + 日期（上下两行） */}
					<div
						className="
							ml-auto
							flex flex-col
							items-end
							flex-shrink-0
							leading-tight
						"
					>
						{/* <span
							className="
								block
								max-w-full
								overflow-hidden
								text-ellipsis
								whitespace-nowrap
								text-[13px]
								font-medium
								tabular-nums
								text-slate-900
							"
						>
							{note}
						</span> */}
						
					</div>
				</div>
			)
}

export default SenderBmo