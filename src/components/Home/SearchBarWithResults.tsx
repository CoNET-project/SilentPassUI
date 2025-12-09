import React, { useEffect, useState, useRef } from 'react'
import { Search } from 'lucide-react'
import { searchUsername} from '@/services/beamio'
import beamio_icon from '@/components/assets/32x32.svg'
export type SearchResultItem = {
	id: string
	label: string
	subtitle?: string
}
const getImg = (avatarSeed: string) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
type searchResult = {
	address: string
	created_at: number
	first_name: string
	image: string
	last_name: string
	username: string
	follow_count: string
	follower_count: string
}

type Props = {
  	onSelect: (item: SearchResultItem) => void
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

const SearchInputWithDropdown: React.FC<Props> = ({ onSelect }) => {
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<searchResult[]>([])
	const [loading, setLoading] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const hasQuery = query.trim().length > 0
	const showDropdown = hasQuery





	const search = async (q: string) => {
		setLoading(true)
		const data = await searchUsername(q)
		setLoading(false)
		const result: searchResult[] = data?.results||[]
		
		setResults(result)
		
	}

	useEffect(() => {
		const q = query.trim().replace('@','')
		if (!q) {
			setResults([])
			setLoading(false)
			return
		}

		search(q)

	}, [query])

	const displayName = (item: searchResult) => {
		const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim()
		return fullName || item.username || item.address
	}



	// 下拉框显示/隐藏时，重新 focus input
	useEffect(() => {
		inputRef.current?.focus()
	}, [showDropdown])

	const handleSelect = (item: SearchResultItem) => {
		onSelect(item)
		setQuery('')
		inputRef.current?.focus()
	}

	const handleBeamioSearch = () => {
		onSelect({
			id: `query:${query}`,
			label: query,
			subtitle: 'Beamio search',
		})
		setQuery('')
		inputRef.current?.focus()
	}

	return (
		<div className="relative w-full h-11">
			{/* 没输入：普通 pill 输入框 */}
			{!showDropdown && (
				<div className="flex items-center bg-slate-100 rounded-full px-3 h-11 flex-1">

					{/* Beamio icon —— 在最左侧 */}
					<img 
						src={beamio_icon}
						alt="Beamio"
						className="w-5 h-5 mr-2 flex-shrink-0 opacity-80"
					/>

					{/* Search icon —— 紧接 Beamio icon */}
					<Search
						className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
						strokeWidth={2}
					/>

					{/* 输入框 */}
					<input
						ref={inputRef}
						className="flex-1 bg-transparent text-[13px] placeholder-slate-400 focus:outline-none"
						placeholder="Find a person or business"
						value={query}
						onChange={e => setQuery(e.currentTarget.value)}
					/>

					</div>
			)}

			{/* 有输入：Google 风格大卡片，input + 下拉合在一起 */}
			{showDropdown && (
				<div
					className="
						absolute inset-x-0 top-0
						rounded-3xl bg-white
						shadow-xl shadow-slate-200/80
						border border-slate-200/80
						overflow-hidden
						z-30
					"
				>
				{/* 顶部：输入行 */}
				<div className="flex items-center bg-slate-100 rounded-full px-3 h-11 flex-1">

				{/* Beamio icon —— 在最左侧 */}
				<img 
					src={beamio_icon}
					alt="Beamio"
					className="w-5 h-5 mr-2 flex-shrink-0 opacity-80"
				/>

				{/* Search icon —— 紧接 Beamio icon */}
				<Search
					className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
					strokeWidth={2}
				/>

				{/* 输入框 */}
				<input
					ref={inputRef}
					className="flex-1 bg-transparent text-[13px] placeholder-slate-400 focus:outline-none"
					placeholder="Find a person or business"
					value={query}
					onChange={e => setQuery(e.currentTarget.value)}
				/>

				</div>

				{/* 下方：search 行 + 结果列表 */}
				<div className="max-h-72 overflow-y-auto py-1">
					{/* 第一行：Beamio search 行 */}
					<button
					type="button"
					className="
						w-full flex items-center gap-2
						px-3 py-2.5 text-left
						hover:bg-slate-50
					"
					onClick={handleBeamioSearch}
					>
					<Search
						className="w-4 h-4 text-slate-500 flex-shrink-0"
						strokeWidth={2}
					/>
					<span className="flex-1 text-[13px] text-slate-700 truncate">
						{query ? `${query} Beamio search` : 'Beamio search'}
					</span>
					{loading && (
						<span className="text-[11px] text-slate-400">
						Searching…
						</span>
					)}
					</button>

					{/* 结果列表 */}
					{!loading &&
	results.map(item => (
  <button
    key={item.address}
    type="button"
    className="
      w-full flex items-center
      px-3 py-2.5 text-left
      hover:bg-slate-50
    "
    onClick={() =>
      handleSelect({
        id: item.address,
        label: item.username,
        subtitle: displayName(item),
      })
    }
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
        className="w-7 h-7 rounded-full object-cover mr-2 flex-shrink-0 bg-slate-200"
      />
    )}

    {/* 中间 + 右侧整体：左右布局 */}
    <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
      {/* 文本区域（左侧） */}
      <div className="flex flex-col min-w-0">
        {/* 第一行：姓名 或 username */}
        <span className="text-[13px] text-slate-900 truncate">
          {displayName(item)}
        </span>

        {/* 第二行：@username · 短地址 */}
        <span className="text-[11px] text-slate-500 truncate">
          @{item.username} · {shortAddress(item.address)}
        </span>

        {/* 第三行：following / followers */}
        <span className="text-[11px] text-slate-400 mt-0.5 truncate">
          {Number(item.follow_count || '0').toLocaleString()} following ·{' '}
          {Number(item.follower_count || '0').toLocaleString()} followers
        </span>
      </div>

      {/* 右侧：创建日期 */}
      <span className="text-[10px] text-slate-400 whitespace-nowrap">
        {formatUserDate(item.created_at)}
      </span>
    </div>
  </button>
))}

					{!loading && results.length === 0 && (
					<div className="px-3 py-2.5 text-[12px] text-slate-400">
						No results
					</div>
					)}
				</div>
				</div>
			)}
		</div>
	)
}

export default SearchInputWithDropdown