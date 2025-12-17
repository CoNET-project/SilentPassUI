import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { Search, ChevronLeft} from 'lucide-react'
import { searchUsername, storeSystemData } from '@/services/beamio'
import beamio_icon from '@/components/assets/32x32.svg'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { CoNET_Data, setCoNET_Data, } from '@/utils/globals'
import { Card, CardContent } from "@/components/ui/card"

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

type Props = {
	close: (path: string | searchResult) => void
	readonly: boolean
	select?: boolean
	showHistory: boolean
}

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

function formatUserDate(timestamp?: string | number): string {
	if (!timestamp) return ""

	const num = Number(timestamp)
	if (!num) return ""

	const ms = num < 10_000_000_000 ? num * 1000 : num
	const d = new Date(ms)
	if (isNaN(d.getTime())) return ""

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric"
	})
}



// ✅ 改成 forwardRef：对外暴露 focus()
const SearchInputWithDropdown = forwardRef(
	({ close, readonly, select, showHistory }: Props) => {
		const { profiles, } = useDaemonContext()

		const [query, setQuery] = useState('')
		const [results, setResults] = useState<searchResult[]>([])
		const [loading, setLoading] = useState(false)
		const inputRef = useRef<HTMLInputElement>(null)
		const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
		const [myAddress, setMyAddress] = useState('')
		const [sideSlide, setSideSlide] = useState<'' | 'BeamioContactProfilePreview'>('')
		const [showDropdown, setShowDropdown] = useState(false)
		const [searchBeamiosHistory, setSearchBeamiosHistory] = useState<searchkeywork[]>([])
		const [searchKeysHistory, setSearchKeysHistory] = useState<searchkeywork[]>([])

		const hasQuery = query.trim().length > 0

		


		const search = async (q: string) => {
			setLoading(true)
			q = q.trim().replace('@', '').toLowerCase()
			const data = await searchUsername(q)
			setLoading(false)

			const result: searchResult[] = data?.results || []
			const filted = result.filter(n => n.address.toLowerCase() !== myAddress)
			if (filted.length) {
				const index = searchKeysHistory.findIndex(n => n.type === 'search' && n.keyward.toLowerCase() === q)
				if (index < 0) {
					setSearchKeysHistory(prev => [...prev, {keyward: q, type:'search'}])
				}
			}
			setResults(filted)
			if (hasQuery) {
				setShowDropdown(true)
			} else {
				setShowDropdown(false)
			}
		}



		useEffect(() => {
			if (!profiles?.length || !CoNET_Data||readonly) return
			const profile: profile = profiles[0]
			setMyAddress(profile.keyID.toLowerCase())
			const search = CoNET_Data?.search|| {
				searchBeamios: [],
				searchKeywords: []
			}

			setSearchKeysHistory(search.searchKeywords)
			setSearchBeamiosHistory(search.searchBeamios)
		}, [])

		useEffect(() => {
			const q = query.trim().replace('@', '')
			if (!q) {
				if (select) {
					setShowDropdown(false)
				}
				setResults([])
				setLoading(false)
				return
			}

			search(q)
		}, [query])



		// 下拉框显示/隐藏时，重新 focus input
		useEffect(() => {
			inputRef.current?.focus()
		}, [showDropdown])

		const handleSelect = (item: searchResult) => {
			if (select) {
				setQuery('')
				setResults([])
				setShowDropdown(false)
				return close(item)
			}
			setUserPreviewItem(item)
			const index = searchBeamiosHistory.findIndex(n => n.beamio?.username === item.username.toLowerCase())
			if (index < 0) {
				const data: searchkeywork = {
					keyward: item.username.toLowerCase(),
					type: 'beamio',
					beamio: item
				}

				setSearchBeamiosHistory((pre => [...pre, data]))
			}
			
			setSideSlide('BeamioContactProfilePreview')
		}

		function recentBeamios() {
			// 1) 取出 beamio 记录
			const beamios = searchBeamiosHistory
				.filter(x => x.type === 'beamio' && x.beamio)
				.map(x => x.beamio as searchResult)

			// 2) 去重：保留“最新出现”的 accountName
			const seen = new Set<string>()
			const unique: searchResult[] = []
			for (const b of beamios) {
				const key = (b.username || '').toLowerCase()
				if (!key || seen.has(key)) continue
				seen.add(key)
				unique.push(b)
			}

			if (unique.length === 0) return null

			return (
				<div className="flex flex-wrap gap-2">
					
					{unique.map(b => {
						const fallback = typeof getImg === 'function' ? getImg(b.image) : ''

						return (
							
								
										<button
											key={b.username}
											type="button"
											onClick={() => handleSelect(b)}
											className="
												inline-flex items-center gap-2
												max-w-full
												rounded-full
												border border-slate-200
												bg-slate-50
												px-3 py-2
												text-left
												hover:bg-slate-100
												active:scale-[0.98]
												transition
											"
										>
											<img
												src={b.image || fallback}
												alt={b.username}
												className="w-6 h-6 rounded-full object-cover flex-shrink-0 bg-slate-200"
											/>

											<span className="min-w-0">
												<span className="block text-[12px] text-slate-900 truncate">
													{displayName(b)}
												</span>
												<span className="block text-[10px] text-slate-500 truncate">
													@{b.username}
												</span>
											</span>
										</button>
								
								
							
							
						)
					})}
				</div>
			)
		}

		const processRef = useRef(false)

		useEffect(() => {
			saveSearchKeywork()
		}, [searchKeysHistory, searchBeamiosHistory])

		const saveSearchKeywork = async () => {
			if (!CoNET_Data ) return
			if (!searchBeamiosHistory.length && !searchKeysHistory.length) return
			// 🔒 全局锁
			if (processRef.current) return
			processRef.current = true

			try {
				CoNET_Data.search = {
					searchBeamios: searchBeamiosHistory,
					searchKeywords: searchKeysHistory
				}

				setCoNET_Data({ ...CoNET_Data }) // ⚠️ 保证引用变化
				await storeSystemData()
			} finally {
				processRef.current = false
			}
		}

		return (
			<>
				{/** Search List */}
				<div className="relative w-full h-11">
					{/* 没输入：普通 pill 输入框 */}
					{!showDropdown && (
						<>
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
								readOnly={readonly}
								ref={inputRef}
								className="flex-1 bg-transparent text-[13px] placeholder-slate-400 focus:outline-none"
								placeholder="Search for @BeamioTag or wallet address"
								value={query}
								onChange={e => setQuery(e.currentTarget.value)}
							/>
						</div>
						
							{!readonly && showHistory && (
								<div className=" mt-6">
									<CardContent className="p-4 space-y-4">
										{recentBeamios()}
									</CardContent>
								</div>
							)}
						
						</>

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
							<div className="flex items-center bg-slate-100 rounded-full px-2 h-11 flex-1">
							{/* ← 返回按钮 */}
							<button
								type="button"
								onClick={() => close('/')}
								className="
								w-7 h-7
								mr-2
								flex items-center justify-center
								rounded-full
								hover:bg-slate-200
								active:scale-95
								transition
								flex-shrink-0
								"
							>
								<ChevronLeft className="w-4 h-4 text-slate-700" />
							</button>

							{/* Beamio icon */}
							<img
								src={beamio_icon}
								alt="Beamio"
								className="w-5 h-5 mr-2 flex-shrink-0 opacity-80"
							/>

							{/* Search icon */}
							<Search
								className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
								strokeWidth={2}
							/>

							{/* 输入框 */}
							<input
								ref={inputRef}
								className="
								flex-1
								bg-transparent
								text-[13px]
								placeholder-slate-400
								focus:outline-none
								"
								placeholder="Search for @BeamioTag or wallet address"
								value={query}
								readOnly={readonly}
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
											onClick={() => handleSelect(item)}
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

				{/* Settings full-screen slide-over */}
				<div
					className={[
						"fixed inset-0 z-40 flex-1 overflow-y-auto",
						"transition-transform duration-300 ease-out",
						sideSlide ? "translate-x-0" : "translate-x-full",
					].join(" ")}
				>
					<div className="flex-1">
						{sideSlide === 'BeamioContactProfilePreview' && userPreviewItem && (
							<BeamioContactProfilePreview
								item={userPreviewItem}
								close={path => {
									if (!path) {
										setUserPreviewItem(null)
										setSideSlide('')
									} else {
										close(path)
									}
								}}
							/>
						)}
					</div>
				</div>

				{

				}
			</>
		)
	}
)

export default SearchInputWithDropdown
