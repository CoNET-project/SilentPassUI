import { IpfsImg } from '@/components/IpfsImg';
import React, { useEffect, useLayoutEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Search, ChevronLeft, QrCode, Loader2 } from 'lucide-react'
import { searchUsername, storeSystemData, handleNfcLinkAppDeepLinkScan, emitWalletEvent } from '@/services/beamio'
import { Toast } from 'antd-mobile'
import BeamioContactProfilePreview from './BeamioContactProfilePreview'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { CoNET_Data, setCoNET_Data, } from '@/utils/globals'
import { Card, CardContent } from "@/components/ui/card"
import { useNavigate, useLocation } from 'react-router-dom'
import {ethers} from 'ethers'
import { getDeprecatedBeamioConetLinkMemo } from '@/utils/deprecatedBeamioConet'
import NavigateLeftButton from '@/components/navigate'
import { collectDeepLinkSearchParams, isCouponOpenClaimDeepLink, isRedeemDeepLink } from '@/utils/beamioDeepLinkParams'
import {
	isDiscoverMerchantDeepLink,
	parseDiscoverMerchantFromParams,
	stripDiscoverMerchantDeepLinkParams,
} from '@/utils/discoverMerchantShare'
import { stashDiscoverShareReferrer } from '@/utils/discoverShareReferrerStash'
import { bindStashedShareRefereesIfNeeded } from '@/utils/discoverShareClickEvent'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import ScanButton, { type ScanButtonHandle } from '@/components/scanBtn/ScanButton'
import { isCashTreesNativeWebView, scanQrViaCashTreesNative } from '@/utils/cashTreesIOSBridge'
import { tu } from '@/locale/beamioLocale'
import {
	BeamioSearchResultRow,
	beamioSearchAvatarUrl,
	beamioSearchDisplayName,
	beamioSearchShortAddress,
	formatBeamioSearchUserDate,
	makeBeamioSearchAddressOnlyResult,
	sortSearchResultsExactFirst,
} from '@/components/Home/beamioSearchResultPresentation'

const getImg = beamioSearchAvatarUrl
type Props = {
	closeWindow: (path: string | searchResult) => void
	select?: boolean
	showHistory: boolean
	showBackIcon?: boolean
	focus?: boolean
	showError?: boolean
	/** Chat 等场景：不渲染全屏白色侧边面板（BeamioContactProfilePreview） */
	showSideSlidePanel?: boolean
	/** PayScreen 等底部弹窗场景：强制下拉菜单向下展开，不使用自适应向上 */
	dropdownDownward?: boolean
}

const displayName = beamioSearchDisplayName
const shortAddress = beamioSearchShortAddress

/** 商家 bill paymentUrl：Amount、currency、acceptTokens 必选；与扫码 QR workflow 一致 */
const isPaymentUrl = (raw: string): boolean => {
	try {
		if (!raw || typeof raw !== 'string') return false
		const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'https://beamio.app')
		const amount = u.searchParams.get('Amount') ?? u.searchParams.get('amount')
		const currency = u.searchParams.get('currency') ?? u.searchParams.get('Currency') ?? ''
		const acceptTokens = u.searchParams.get('acceptTokens') ?? u.searchParams.get('accepttokens') ?? ''
		if (!amount || Number(amount) <= 0) return false
		if (!currency || !acceptTokens) return false
		if (u.pathname === '/Vouchers' || /beamio\.app/i.test(u.origin)) return true
		return /\/Vouchers/i.test(u.pathname)
	} catch {
		return false
	}
}

const formatUserDate = formatBeamioSearchUserDate

// ✅ 改成 forwardRef：对外暴露 focus()
const SearchInputWithDropdown = 
	({ closeWindow, select, showHistory, showBackIcon=true, focus = false, showError = false, showSideSlidePanel = true, dropdownDownward = false }: Props) => {
		const { profiles, beamio, setPaymentLinkCode, setSecureCode, setRedeemCode, setPayMePayment, setNavigateLeftButtonArray, setShowFooter, setScanData, setScanIntent, setVoucherPayFromScan } = useDaemonContext()
		const navigate = useNavigate()
		const [query, setQuery] = useState('')
		const [results, setResults] = useState<searchResult[]>([])
		const [loading, setLoading] = useState(false)
		const inputRef = useRef<HTMLInputElement>(null)
		const scanBtnRef = useRef<ScanButtonHandle>(null)
		const [qrScanBusy, setQrScanBusy] = useState(false)
		const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()
		const [myAddress, setMyAddress] = useState('')
		const [sideSlide, setSideSlide] = useState<'' | 'BeamioContactProfilePreview'>('')
		const [showDropdown, setShowDropdown] = useState(false)
		const [dropdownUpwards, setDropdownUpwards] = useState(false)
		const containerRef = useRef<HTMLDivElement>(null)
		const [searchBeamiosHistory, setSearchBeamiosHistory] = useState<searchkeywork[]>([])
		const [searchKeysHistory, setSearchKeysHistory] = useState<searchkeywork[]>([])
		const [readonly, setReadonly] = useState(!focus)
		useEffect(() => { setReadonly(!focus) }, [focus])
		const hasQuery = query.trim().length > 0
		const [internalError, setInternalError] = useState(showError)

		// 1) 把 hasQuery 改成基于“去掉@并trim”的长度
		const normalizedQuery = query.trim().replace('@', '')
		const canSearch = normalizedQuery.length >= 2

		
		const requestUrl = async (url: URL) => {
			
			setLoading(true)
			

			const searchParams = collectDeepLinkSearchParams(url.href)

			// Vouchers 支付请求 URL：与扫码 QR workflow 相同，走 Smart Routing Analysis
			if (isPaymentUrl(url.href)) {
				setScanData(url.href)
				setScanIntent('voucherPay')
				setVoucherPayFromScan(true)
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/History')
				navigate('/History')
				return
			}

			const nfcLinkRes = await handleNfcLinkAppDeepLinkScan(url.href)
			if (nfcLinkRes !== null) {
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/History')
				Toast.show({
					icon: nfcLinkRes.success ? 'success' : 'fail',
					content: nfcLinkRes.success ? tu('nfc_card_linked_to_your_wallet') : (nfcLinkRes.error || tu('link_failed')),
				})
				navigate('/History')
				return
			}
	
			let code = searchParams.get("code")||''
			const _secureCode = searchParams.get("secureCode")||searchParams.get("securecode")||''
			const cashcode = searchParams.get("cashcode")||''
			const _beamio = searchParams.get("beamio")||''
			const _beamiocard = searchParams.get("beamiocard") || searchParams.get("Beamiocard") || ''
			const _redeemcode = searchParams.get("redeemcode") || searchParams.get("Redeemcode") || ''
			const _couponId = decodeURIComponent((searchParams.get("couponId") || searchParams.get("couponid") || '').trim())
			const _claim = (searchParams.get("claim") || '').trim().toLowerCase()

			// BeamioUserCard redeem URL：交由 App scanData workflow 打开 Redeem 确认页
			if (_redeemcode?.trim()) {
				setScanIntent('')
				setScanData(url.href)
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/History')
				navigate('/History')
				return
			}

			// Coupon open-claim URL：交由 App scanData workflow 打开 Claim 确认页
			if (_beamiocard?.trim() && _couponId && (!_claim || _claim === 'open' || _claim === '1' || _claim === 'true')) {
				setScanIntent('')
				setScanData(url.href)
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/History')
				navigate('/History')
				return
			}

			// Discover merchant share (incl. /app-download?target=…&beamiocard=&discover=open&ref=)
			// → /discover detail + stash ref= so opener EOA binds as downline of referee EOA.
			const parsedDiscover = parseDiscoverMerchantFromParams(searchParams)
			if (parsedDiscover) {
				stashDiscoverShareReferrer(parsedDiscover.cardAddress, parsedDiscover.referrerEoa)
				const privateKeyArmor = resolveSigningPrivateKeyArmor(profiles?.[0])
				if (privateKeyArmor) {
					void bindStashedShareRefereesIfNeeded(privateKeyArmor)
				}
				setScanIntent('')
				setShowFooter(false)
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/discover')
				navigate('/discover', {
					state: {
						openDiscoverMerchantCard: parsedDiscover.cardAddress,
						discoverShareReferrerEoa: parsedDiscover.referrerEoa,
					},
				})
				stripDiscoverMerchantDeepLinkParams()
				return
			}

			if (_beamio) {
				// 输入自己时：直接进入我的钱包
				if (beamio?.accountName && String(_beamio).trim().toLowerCase() === String(beamio.accountName).toLowerCase()) {
					setLoading(false)
					setShowDropdown(false)
					closeWindow('/myWallet')
					return navigate('/myWallet')
				}
				// 与扫码 workflow 对齐：交由 App checkUrl 处理（BeamioContactProfilePreview + preferredPayeeWallet）
				setScanData(url.href)
				setLoading(false)
				setShowDropdown(false)
				closeWindow('/')
				navigate('/History')
				return
			}
			if (_secureCode) {
				setSecureCode (_secureCode)
				setRedeemCode(cashcode)
				return navigate('/History')
			}

			if (code) {

				if (!code.startsWith('0x')) {
					code = ethers.solidityPackedKeccak256(['string'], [code])
					
				}
				try {
					const fx = await getDeprecatedBeamioConetLinkMemo(code)
					if (fx.to !== ethers.ZeroAddress) {
						setPaymentLinkCode(code)
						return navigate('/browser')
					}
					
				} catch (ex) {
					console.log(`await CoreContract.getLinkMemo(code) Error`)
				}
				
				
			}

			

		}

		// 2) search() 内部不要再用 hasQuery（它是旧的 render 值），改成用传入 q 的长度控制 dropdown
		const search = async (q: string) => {
		const qq = q.trim().replace('@', '')

		// ✅ 少于2个字符：不搜索，不显示下拉
		if (qq.length < 2) {
			setLoading(false)
			setResults([])
			setShowDropdown(false)
			return
		}

		setLoading(true)

		// URL 逻辑：只有长度>=2才会走到这里（符合你的要求）
		try {
			let url: URL
			try {
				url = new URL(qq)
			} catch {
				// 智能对应：无协议时，尝试以 beamio.app 为 base 解析
				if (
					/nftRedeemcode=|redeemcode=|beamiocard=|couponid=|couponId=|app-download/i.test(qq)
				) {
					let candidate = qq
					if (!/^https?:\/\//i.test(candidate)) {
						if (candidate.startsWith('/')) {
							candidate = `https://beamio.app${candidate}`
						} else if (/^beamio\.app/i.test(candidate)) {
							candidate = `https://${candidate}`
						} else if (/^app-download\?/i.test(candidate)) {
							candidate = `https://beamio.app/${candidate}`
						} else if (candidate.startsWith('?')) {
							candidate = `https://beamio.app/app/${candidate}`
						} else {
							candidate = `https://beamio.app/app/?${candidate}`
						}
					}
					url = new URL(candidate)
				} else if ((/Amount=/i.test(qq) && /Vouchers|beamio\.app/i.test(qq)) && !/^https?:\/\//i.test(qq)) {
					// Vouchers 支付 URL 无协议时补全（如 beamio.app/Vouchers?Amount=... 或 /Vouchers?Amount=...）
					const withProto = qq.startsWith('/') ? 'https://beamio.app' + qq : 'https://' + qq
					if (isPaymentUrl(withProto)) url = new URL(withProto)
					else throw new Error('not url')
				} else {
					throw new Error('not url')
				}
			}
			if (
				url.protocol === 'https:' ||
				url.protocol === 'http:' ||
				isRedeemDeepLink(url.href) ||
				isCouponOpenClaimDeepLink(url.href) ||
				isDiscoverMerchantDeepLink(url.href)
			) {
				await requestUrl(url)
				setLoading(false)
				setShowDropdown(false)
				return
			}
			setInternalError(true)
			setLoading(false)
			setShowDropdown(false)
			return
		} catch {
			// 非 URL，继续走用户名/地址搜索
		}

		const lower = qq.toLowerCase()

		const data = await searchUsername(qq)
		const result: searchResult[] = data?.results || []
		const filted = result.filter(n => n.address.toLowerCase() !== myAddress)

		if (filted.length) {
			const index = searchKeysHistory.findIndex(
			n => n.type === 'search' && n.keyward.toLowerCase() === lower
			)
			if (index < 0) {
			setSearchKeysHistory(prev => [...prev, { keyward: lower, type: 'search' }])
			}
		} else {
			if (ethers.isAddress(lower)) {
			filted.push(makeBeamioSearchAddressOnlyResult(lower))
			}
		}

		setResults(sortSearchResultsExactFirst(filted, qq))
		setLoading(false)

		// ✅ 只有 >=2 才打开 dropdown
		setShowDropdown(true)
		}

		const pillClass = [
			"flex items-center",
			"bg-white",
			"rounded-full",
			"px-2",
			"h-11 shrink-0",
			"flex-1",
			"transition",
				
			// ✅ 错误态：整条红色外框
			internalError
				? "ring-1 ring-red-500 focus-within:ring-2 focus-within:ring-red-500"
				: "ring-1 ring-transparent focus-within:ring-slate-300",
		].join(" ")

		const handleQrScanClick = useCallback(async () => {
			if (qrScanBusy || scanBtnRef.current?.isScanning()) return

			if (isCashTreesNativeWebView()) {
				setQrScanBusy(true)
				try {
					const result = await scanQrViaCashTreesNative()
					if (result.ok) {
						setScanData(result.text)
						emitWalletEvent('scan:url', result.text)
						closeWindow('/')
						return
					}
					if (!result.cancelled) {
						Toast.show({ icon: 'fail', content: tu('qr_scan_failed') })
					}
				} finally {
					setQrScanBusy(false)
				}
				return
			}

			scanBtnRef.current?.start({ hideModeSwitcher: true })
		}, [qrScanBusy, setScanData, closeWindow])

		const renderQrScanButton = () => (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					void handleQrScanClick()
				}}
				disabled={qrScanBusy}
				aria-label="Scan QR code"
				className="
					w-7 h-7
					ml-1
					flex items-center justify-center
					rounded-full
					hover:bg-slate-200
					active:scale-95
					transition
					flex-shrink-0
					disabled:opacity-50 disabled:pointer-events-none
				"
			>
				{qrScanBusy ? (
					<Loader2 className="w-4 h-4 text-slate-500 animate-spin" strokeWidth={2} />
				) : (
					<QrCode className="w-4 h-4 text-slate-600" strokeWidth={2} />
				)}
			</button>
		)

		useEffect(() => {
			if (!profiles?.length || !CoNET_Data||readonly) return
			const profile: profile = profiles[0]
			const addr = profile?.keyID || profile?.aaAccount
			if (addr) setMyAddress(String(addr).toLowerCase())
			const search = CoNET_Data?.search|| {
				searchBeamios: [],
				searchKeywords: []
			}

			setSearchKeysHistory(search.searchKeywords)
			setSearchBeamiosHistory(search.searchBeamios)
		}, [])

		// 3) query effect：少于2就直接收起；>=2 才 search
		useEffect(() => {
		const q = query.trim().replace('@', '')

		// ✅ 清空：隐藏 dropdown & 清数据
		if (!q) {
			if (select) setShowDropdown(false)
			setResults([])
			setLoading(false)
			setInternalError(false) // 可选：清空时顺便清错误
			return
		}

		// ✅ 第1个字符：不搜索、不下拉
		if (q.length < 2) {
			setResults([])
			setLoading(false)
			setShowDropdown(false)
			return
		}

		search(q)
		}, [query])



		// 下拉框显示/关闭时，保持 focus 在 input（切换分支会挂载新 input，需主动 focus）
		useEffect(() => {
			if (readonly) return
			// 延迟一帧确保新 input 已挂载、ref 已绑定
			const id = requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
			return () => cancelAnimationFrame(id)
		}, [showDropdown, readonly])

		useEffect(() => {
			if (readonly) setShowDropdown(false)
		}, [readonly])

		useEffect(() => {
			setInternalError(showError)
		}, [showError])

		// 靠近底部时，Dropdown 向上弹出；远离底部时保持向下（dropdownDownward 为 true 时强制向下）
		useLayoutEffect(() => {
			if (!showDropdown || !containerRef.current) return
			if (dropdownDownward) {
				setDropdownUpwards(false)
				return
			}
			const rect = containerRef.current.getBoundingClientRect()
			const spaceBelow = window.innerHeight - rect.bottom
			const spaceAbove = rect.top
			setDropdownUpwards(spaceBelow < spaceAbove)
		}, [showDropdown, dropdownDownward])

		const handleSelect = (item: searchResult) => {
			if (select) {
				setQuery('')
				setResults([])
				setShowDropdown(false)
				return closeWindow(item)
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

			setNavigateLeftButtonArray([{
											title: '',
											action: [
												// () => navigate('/History'),
												() => setSideSlide(''),
												
											]

										}])
										setShowFooter(false)
			
			setSideSlide('BeamioContactProfilePreview')
		}

		const [initialHeight, setInitialHeight] = useState(window.innerHeight);

		// ✅ FIX 2: 核心修复函数 - 处理 iOS 键盘弹起时的视口滚动
        const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
            // 只有在移动端才需要修正，或者全局修正
            // 延时 300ms 是为了等待 iOS 键盘完全弹起，视口高度变化完成
           const checkHeight = () => {
				if (window.innerHeight < initialHeight) {
				// 键盘已弹起（视口高度变小）
				if (inputRef.current) {
					inputRef.current.scrollIntoView({ block: 'center' });
				}
				} else {
				requestAnimationFrame(checkHeight);
				}
			};
			requestAnimationFrame(checkHeight);
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
											<IpfsImg
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

		useEffect(() => {
			saveSearchKeywork()
		}, [searchKeysHistory, searchBeamiosHistory])

		return (
			<>
				<ScanButton
					ref={scanBtnRef}
					hidden
					hideModeSwitcher
					onAfterScan={() => closeWindow('/')}
				/>
				{/** Search List */}
				{/* ✅ FIX 3: 增加 z-50 确保层级
                   ✅ FIX 4: 增加 pt-[env(safe-area-inset-top)] 确保不会被刘海遮挡
                   如果这个组件是整个页面的顶部，必须加这个 padding
                */}

				<div ref={containerRef} className="relative w-full h-11"
				>
					{/* 没输入：普通 pill 输入框 */}
					{!sideSlide && !showDropdown && (
						<>
						<div className={pillClass}>
							{/* ← 返回按钮 */}
							{
								!readonly && showBackIcon && (
									<button
										type="button"
										onClick={() => {
											closeWindow('/')
										}}
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
								)
							}
							
							{/* Beamio icon —— 在最左侧 */}
							{/* <IpfsImg
								src={beamio_icon}
								alt="Beamio"
								className={[
									'w-5 h-5 mr-2 flex-shrink-0 opacity-80',
									readonly ? 'ml-2' : ''
								].join(' ')}
							/> */}

							{/* Search icon —— 紧接 Beamio icon */}
							<Search
								className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
								strokeWidth={2}
							/>

							{/* 输入框 */}
							
							{readonly ? (
							// ✅ Fake input：不是真 input，iOS 不会弹键盘
							<div
								role="button"
								tabIndex={0}
								onClick={() => {
									setReadonly(false)
								}}
								onKeyDown={e => {
									if (e.key === "Enter" || e.key === " ") closeWindow("/")
								}}
								className="
									flex-1 min-w-0
									bg-transparent text-left
									text-[13px] text-slate-500
									focus:outline-none
									cursor-text
									truncate
								"
								>
								{"@BeamioTag, address, or paste link"}
								</div>
							) : (
								<input
									ref={inputRef}
									type="text"
									inputMode="search"
									enterKeyHint="search"
									autoCorrect="off"
									autoCapitalize="none"
									spellCheck={false}
									autoComplete="off"
									className="flex-1 bg-transparent text-[13px] placeholder-slate-400 focus:outline-none"
									placeholder="@BeamioTag, address, or paste link"
									value={query}
									// ✅ FIX 5: 绑定 Focus 处理函数
									onFocus={handleInputFocus}
									onChange={e => setQuery(e.currentTarget.value)}
								/>
							)}
							{renderQrScanButton()}
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
					{!sideSlide && showDropdown && (
						<div
							className={[
								"absolute inset-x-0",
								"rounded-3xl bg-white",
								"shadow-xl shadow-slate-200/80",
								"border border-slate-200/80",
								"overflow-hidden",
								"z-30",
								"flex flex-col",
								dropdownUpwards ? "top-0 -translate-y-full flex-col-reverse mb-1" : "top-0",
							].join(" ")}
						>
							{/* 输入行：固定高度，不参与 flex 伸缩 */}
							<div
								className={[
									pillClass,
									"!flex-none !h-11 !min-h-11",
								].join(" ")}
								style={{ height: 44, minHeight: 44 }}
							>
								{/* ← 返回按钮 */}
								{
									!readonly && showBackIcon && (
										<button
											type="button"
											onClick={() => closeWindow('/')}
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
									)
								}
								

								{/* Search icon */}
								<Search
									className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
									strokeWidth={2}
								/>

								{/* 输入框 */}
									<input
										ref={inputRef}
										className={[
											"flex-1",
											"bg-transparent",
											"text-[13px]",
											"placeholder-slate-400",
											"focus:outline-none",

											
										].join(" ")}
										placeholder="Search for @BeamioTag or wallet address"
										value={query}
										inputMode="search"
										
										readOnly={readonly}
										onChange={e => setQuery(e.currentTarget.value)}
										// ✅ FIX 7: 下拉模式下的 Input 也要绑定
										onFocus={handleInputFocus}
									/>
								{renderQrScanButton()}
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
									results.map((item) => (
										<BeamioSearchResultRow
											key={item.address}
											item={item}
											query={query}
											onSelect={handleSelect}
										/>
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

				{/* Settings full-screen slide-over（showSideSlidePanel=false 时不渲染，如 Chat 页） */}
				{showSideSlidePanel && (
				<div
						className={[
							"pt-[env(safe-area-inset-top)]",
							'pb-[env(safe-area-inset-bottom)]',
							'pl-[env(safe-area-inset-left)]',
							'pr-[env(safe-area-inset-right)]',
							"fixed inset-0 z-40 flex-1 overflow-y-auto",
							"transition-transform duration-300 ease-out",
							(!!sideSlide) ? "translate-x-0" : "translate-x-full",
						].join(" ")}
					>

						{/* Header：返回 + 居中标题 */}
						<div
							className="
								absolute
								top-[env(safe-area-inset-top)]
								left-0 right-0
								h-14
								flex items-center
								px-4
								z-50
								bg-transparent
								pointer-events-none
							"
						>
							<div className="
							fixed
							top-0 left-0 right-0
							z-50
							bg-transparent
							pointer-events-none
							">
								<div className="
								px-4
								pt-[calc(env(safe-area-inset-top)+8px)]
								pb-2
								pointer-events-auto
								">
									<NavigateLeftButton />
								</div>
							</div>

							
						</div>

					
					<div className="flex-1 mt-14">
						{sideSlide === 'BeamioContactProfilePreview' && userPreviewItem && (
							<BeamioContactProfilePreview
								item={userPreviewItem}
								close={path => {
									
									
								}}
							/>
						)}
					</div>
				</div>
				)}

				
			</>
		)
	}


export default SearchInputWithDropdown
