import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createPortal } from 'react-dom';
import { ethers } from "ethers"
import { baseEndpoint, USDCContract_BASE } from "@/utils/constants"
import { useDaemonContext } from "@/providers/DaemonProvider"
import usdc_abi from '@/services/ABI/usdc_abi.json'
import {motion, AnimatePresence } from "framer-motion"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { getBalanceProcess, getUsdcBalanceFromApi, formatWithThousands, aesGcmDecrypt } from '@/services/beamio'
import { isRpcDegraded, reportRpcFailure, isRpcQuotaOrNetworkError } from '@/utils/rpcStatus'
import RedeemScreen from '@/pages/Browser/RedeemScreen'
import { parseNodeEX,ParsedNote } from "@/services/currency"
import {
  QrCode,
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  ScanLine,
  Landmark,
  Loader,
  CalendarCheck,
  Banknote,
  HelpCircle,
  Sparkles,
  Zap,
  Plus,
  Copy,
  Check,
} from "lucide-react"
import AccountBeo from "./AccountBea"
import { fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived, calcFeeFromNumber } from "@/services/currency"
import base_icon from '@/components/assets/base-logo.png'
import usdc_icon from '@/components/assets/usdc.png'
import PayScreen from '@/pages/Pay/send/index'
import PaymentLink from '@/pages/Pay/PaymentLink/index'
import NavigateLeftButton from '@/components/navigate'
import Cashcode from '@/pages/Pay/Cashcode/index'
import BankingBridge from './components/BankingBridge'
import {TransactionsItemDetail} from '@/pages/History/TransactionsItemDetail'
import ActivePannel from "./components/activePannel"
import ActiveList from '@/pages/Vouchers/ActiveList'
import ActionItemDetail from '@/pages/Vouchers/ActionItemDetail'
import { getMyAssets } from '@/services/BeamioCard'
import { CCSA_Card_Address } from '@/utils/constants'
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen, type OpenContainerRelayPayload } from '@/services/AAaccount'
import BeamioPayMe from '@/pages/Pay/BeamioPayMe'
import TenKeyInput from '@/pages/Pay/components/TenKeyInput'

type SectionTx = TransferHistork

const showPaylinkSite = "https://beamio.app"

const getBadgeClass = (type: HistoryFilter) => {
  switch (type) {
    case "sent":
      return "bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200"
    case "received":
      return "bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200"
    case "pending":
      return "bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200"
    case "completed":
      return "bg-sky-300/35 text-sky-800 dark:bg-sky-700/35 dark:text-sky-200"
    case "reject":
      return "bg-rose-300/35 text-rose-700 dark:bg-rose-700/35 dark:text-rose-200"
    case "paid":
      return "bg-fuchsia-300/35 text-fuchsia-800 dark:bg-fuchsia-700/35 dark:text-fuchsia-200"
    case "deposited":
      return "bg-indigo-300/35 text-indigo-800 dark:bg-indigo-700/35 dark:text-indigo-200"
    case "all":
    default:
      return "bg-slate-700/20 text-slate-800 dark:bg-white/10 dark:text-slate-200"
  }
}

const MiniAction = ({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex flex-col items-center gap-2
        active:scale-[0.98]
        transition
        select-none
      "
    >
      <div
        className="
          h-14 w-14 rounded-2xl
          bg-white/90 dark:bg-slate-900/70
          shadow-[0_10px_24px_rgba(0,0,0,0.12)]
          ring-1 ring-black/5 dark:ring-white/10
          flex items-center justify-center
        "
      >
        {icon}
      </div>
      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {label}
      </div>
    </button>
  )
}

const Row = ({
  tx,
  mode,
  onOpen
}: {
  tx: SectionTx
  mode: Mode
  onOpen?: (tx: SectionTx) => void
}) => {
  const hasHash = !!tx.hash
  const clickableClass = hasHash ? "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5" : "cursor-default opacity-70"
  const plus = tx.type1 === "received"

  return (
    <div
      onClick={() => hasHash && onOpen?.(tx)}
      className={[
        "flex items-center gap-2 px-3 py-3",
        "border-b border-slate-200/70 dark:border-slate-800/70",
        "transition",
        clickableClass
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <AccountBeo address={tx.address} note="" dateData={formatTimev2(tx.date)} tx={tx} localMode={mode} />
      </div>

      <div className="shrink-0 flex items-center gap-1">
        {mode !== "pay" && (
          <span
            className={[
              "inline-flex items-center justify-center",
              "w-7 h-7 rounded-full",
              getBadgeClass(tx.type as HistoryFilter)
            ].join(" ")}
            title={tx.type}
          >
            {tx.type === "pending" ? (
              <Loader className="w-4 h-4" strokeWidth={2} />
            ) : tx.type === "completed" ? (
              <CalendarCheck className="w-4 h-4" strokeWidth={2} />
            ) : tx.type === "paid" || tx.type === "deposited" ? (
              <Banknote className="w-4 h-4" strokeWidth={2} />
            ) : (
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            )}
          </span>
        )}
      </div>

      <div
        className={[
          "shrink-0 whitespace-nowrap text-right w-[150px] font-medium tabular-nums",
          plus ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
        ].join(" ")}
      >
        <div className="flex justify-end items-start gap-1.5">
          <span className="text-[14px] leading-[20px]">{plus ? "+" : "−"}</span>

          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-[14px] font-semibold tabular-nums leading-[20px]">
              {formatAmount(tx.type === "sent" ? tx.preAmount : tx.amount, "USDC")} USDC
            </span>

            {tx?.requestDetail && (
              <span className="text-[12px] tabular-nums text-slate-400 leading-[16px]">
                {fiatPrefix(tx.requestDetail.requestCurrency)}{" "}
                {formatAmount(
                  tx.type1 === "sent" ? tx.requestDetail.totalPayCurrency : tx.requestDetail.requestCurrencyAmount||0,
                  tx.requestDetail.requestCurrency
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MyWalletDashboard() {
	const navigate = useNavigate()
	const {
		profiles,
		myAddress,
		setMyAddress,
		setUsdcbalance,
		usdcbalance,
		currencyData,
		setUsdcToUSD,
		setShowFooter,
		setNavigateLeftButtonArray,
		historyPayData,
		setSecureCode,
		redeemCode,
		setRedeemCode,
		setScanIntent,
		setScanData,
		setVoucherPayAmount,
		setVoucherPayToAA,
		setVoucherPayError,
	} = useDaemonContext()

	const [loading, setLoading] = useState(false)
	const [allItems, setAllItems] = useState<TransferHistork[]>([])
	const [reflash, setReflash] = useState(false)
	const [aaAccountUsdcBalance, setAaAccountUsdcBalance] = useState<string>('0')
	const [activeSlide, setActiveSlide] = useState(0) // 0: USDC on Base, 1: Express Pay
	const [touchStart, setTouchStart] = useState<number | null>(null)
	const [touchEnd, setTouchEnd] = useState<number | null>(null)
	const [mouseStart, setMouseStart] = useState<number | null>(null)
	const [mouseEnd, setMouseEnd] = useState<number | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [wheelDelta, setWheelDelta] = useState(0)
	const carouselRef = useRef<HTMLDivElement>(null)
	const [settingsOpen, setSettingsOpen] = useState<''|'Pay'|'BeamioPayMe'|'BeamioPayMeQR'|'Cashcode'|'BankingBridge'|'RedeemScreen'>('')
	const [openRelayPayload, setOpenRelayPayload] = useState<OpenContainerRelayPayload | null>(null)
	const [payMeSigning, setPayMeSigning] = useState(false)
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'BeamioAlphaHowItWorks'|'BeamioLearnHowItWorksCard'|'Pay'|'TransactionsItemDetail'|
			''|'BeamioAlphaDropConfirm'|'BeamioTestBalance'|'OnrampOfframpGuide'|'Search'|'BeamioContactProfilePreview'|'CoinbaseRamps'|'PayMe'>('')

	const [itemTx, setItemtx] = useState<TransferHistork>()
	const [smartAccountCardAssets, setSmartAccountCardAssets] = useState<MyCardAssets | null>(null)
	const [selectedActionItem, setSelectedActionItem] = useState<BeamioActionResponse | null>(null)
	const [addressCopied, setAddressCopied] = useState<'eoa' | 'aa' | null>(null)
	const copyAddressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const refreshAAAssetsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [payScreenMode, setPayScreenMode] = useState<'eoa-pay' | 'aa-eoa-transfer'>('eoa-pay')
	const [showTenKeySlide, setShowTenKeySlide] = useState(false)

	const copyAddress = useCallback((address: string, which: 'eoa' | 'aa') => {
		navigator.clipboard?.writeText(address).then(() => {
			if (copyAddressTimeoutRef.current) clearTimeout(copyAddressTimeoutRef.current)
			setAddressCopied(which)
			copyAddressTimeoutRef.current = setTimeout(() => {
				setAddressCopied(null)
				copyAddressTimeoutRef.current = null
			}, 3000)
		})
	}, [])

	useEffect(() => () => {
		if (copyAddressTimeoutRef.current) clearTimeout(copyAddressTimeoutRef.current)
		if (refreshAAAssetsTimeoutRef.current) clearTimeout(refreshAAAssetsTimeoutRef.current)
	}, [])

	// 触摸滑动处理
	const minSwipeDistance = 50

	const onTouchStart = (e: React.TouchEvent) => {
		setTouchEnd(null)
		setTouchStart(e.targetTouches[0].clientX)
	}

	const onTouchMove = (e: React.TouchEvent) => {
		setTouchEnd(e.targetTouches[0].clientX)
	}

	const onTouchEnd = () => {
		if (!touchStart || !touchEnd) return
		const distance = touchStart - touchEnd
		const isLeftSwipe = distance > minSwipeDistance
		const isRightSwipe = distance < -minSwipeDistance

		if (isLeftSwipe && activeSlide < 1) {
			setActiveSlide(1)
		}
		if (isRightSwipe && activeSlide > 0) {
			setActiveSlide(0)
		}
	}

	// 鼠标拖动处理
	const onMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true)
		setMouseEnd(null)
		setMouseStart(e.clientX)
	}

	const onMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return
		setMouseEnd(e.clientX)
	}

	const onMouseUp = () => {
		if (!isDragging) return
		if (!mouseStart || !mouseEnd) {
			setIsDragging(false)
			return
		}
		const distance = mouseStart - mouseEnd
		const isLeftDrag = distance > minSwipeDistance
		const isRightDrag = distance < -minSwipeDistance

		if (isLeftDrag && activeSlide < 1) {
			setActiveSlide(1)
		}
		if (isRightDrag && activeSlide > 0) {
			setActiveSlide(0)
		}
		setIsDragging(false)
		setMouseStart(null)
		setMouseEnd(null)
	}

	const onMouseLeave = () => {
		if (isDragging) {
			setIsDragging(false)
			setMouseStart(null)
			setMouseEnd(null)
		}
	}

	// Trackpad 水平滑动处理 - 使用原生事件监听器确保正确阻止默认行为
	useEffect(() => {
		const carousel = carouselRef.current
		if (!carousel) return

		const handleWheel = (e: WheelEvent) => {
			// 当鼠标在卡片区域时，阻止所有滚动事件的默认行为
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
			
			// 只处理水平滚动（deltaX）
			if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
				setWheelDelta((prevDelta) => {
					const newDelta = prevDelta + e.deltaX

					// 当累积滚动量达到阈值时切换卡片
					if (Math.abs(newDelta) >= minSwipeDistance) {
						setActiveSlide((prevSlide) => {
							if (newDelta > 0 && prevSlide < 1) {
								// 向右滚动（deltaX > 0）切换到下一个
								return 1
							} else if (newDelta < 0 && prevSlide > 0) {
								// 向左滚动（deltaX < 0）切换到上一个
								return 0
							}
							return prevSlide
						})
						return 0
					}
					return newDelta
				})
			}
		}

		// 使用 { passive: false } 和 capture: true 确保在捕获阶段就阻止事件
		carousel.addEventListener('wheel', handleWheel, { passive: false, capture: true })

		return () => {
			carousel.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions)
		}
	}, [])


	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])

	const fxRateUSDCToCurrency = useCallback(
		(currency: ICurrency) => {
		const u2u = (currencyData as any)?.USDC ?? 1
		if (currency === "USD") return u2u
		const usdToCurrency = (currencyData as any)?.[currency]
		if (typeof usdToCurrency !== "number") return u2u
		return u2u * usdToCurrency
		},
		[currencyData]
	)

	useEffect(() => {
		if (historyPayData) {
			setPayScreenMode('eoa-pay')
			setShowFooter(false)
			setSettingsOpen('Pay')
			return
		}
		if (redeemCode) {

			setSettingsOpen('RedeemScreen')
			return
		}
	}, [redeemCode, historyPayData])

	const balanceFiat = useMemo(() => {
		const c: ICurrency = "CAD"
		const rate = fxRateUSDCToCurrency(c)
		const n = Number(usdcbalance || 0)
		if (!isFinite(rate) || !isFinite(n)) return 0
		return n * rate
	}, [usdcbalance, fxRateUSDCToCurrency])

	const load = useCallback(async () => {
		if (!profiles?.length) return
		const profile: profile = profiles[0]
		const address = profile.keyID
		if (!myAddress) setMyAddress(address)

		setLoading(true)
		try {
		const myAddrLocal = address.toLowerCase()

		// 旧合约 getTransferHistory/getLinksHistory/getCheckHistory 已停用
		const _transfer: [string[], Transfer[]] = [[], []]
		const _links: [string[], LinksHistory[]] = [[], []]
		const _checks: [string[], any[]] = [[], []]

		const transfer: Transfer[] = _transfer[1]
		const mappedPay: TransferHistork[] = transfer.map(n => {
			let requestDetail: IRequestCurrencyDetail | undefined = undefined
			const {noteText, card, payme}:ParsedNote = parseNodeEX(n.note)

			const amount = Number(ethers.formatUnits(n.amount, 6))
			const _amount = Number((payme as any)?.currencyAmount)

			if ((payme as any)?.currency && fiatPrefix((payme as any).currency) && !isNaN(_amount) && _amount > 0) {
				const currencyRate = Number((payme as any).currencyAmount) / amount
				requestDetail = {
					requestCurrency: (payme as any).currency,
					totalPayCurrency: Number((payme as any).currencyAmount),
					totalPayUSDC: amount,
					feeCurrency: 0,
					feeUSDC: 0,
					receivedCurrency: Number((payme as any).currencyAmount),
					receivedUSDC: amount,
					currencyTip: 0,
					USDCTip: 0,
					rate: currencyRate,
					title: (payme as any)?.title,
					textNote: noteText,
					requestCurrencyAmount: Number((payme as any).currencyAmount),
				}
			}

			const ret: TransferHistork = {
				date: Number(n.timestamp * BigInt(1000)),
				amount,
				address: n.from.toLowerCase() === myAddrLocal ? n.to.toLowerCase() : n.from.toLowerCase(),
				hash: n.finisedHash,
				requestCurrency: (payme as any)?.currency || "USDC",
				note: n.note,
				type: myAddrLocal === n.to.toLowerCase() ? "received" : "sent",
				mode: "pay",
				fee: 0,
				type1: myAddrLocal === n.to.toLowerCase() ? "received" : "sent",
				preAmount: amount,
				requestDetail
			}

			if (card?.image) ret.card = card
			return ret
		})

		const links: LinksHistory[] = _links[1]
		let mappedLinks: TransferHistork[] = links.map(n => {
			const isRequest = n.from.toLowerCase() === myAddrLocal
			const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
			const isReject = isRequest
			? n.to === "0x1000000000000000000000000000000000000000"
			: n.from === "0x1000000000000000000000000000000000000000"

			const account = isPending || isReject ? "" : isRequest ? n.to : n.from

			const payAmount = Number(ethers.formatUnits(n.payAmount, 6))
			const _requestCurrencyData = (n?.node || "").split("\r\n")
			const tail = _requestCurrencyData[_requestCurrencyData.length - 1]

			let requestCurrency: ICurrency = "USDC"
			let group: paymentType = "onetime"
			let requestDetail: IRequestCurrencyDetail | undefined = undefined
			let type: HistoryFilter = isPending ? "pending" : isRequest ? "sent" : "received"

			try {
			const kkk = JSON.parse(tail)
			if (kkk) {
				requestCurrency = kkk.currency
				if (typeof kkk?.oneTimeMode === "undefined") group = "payme"
				else group = kkk.oneTimeMode ? "onetime" : "reusable"
			}

			const totalPayUSDC = payAmount
			if (totalPayUSDC) {
				const feeUSDC = calcFeeFromReceived(totalPayUSDC)
				const requestCurrencyAmount = Number(kkk?.currencyAmount || 0)
				const currencyTip = Number(kkk?.currencyTip || 0)
				const taxCurrency = Number(kkk?.currencyTax || 0)
				const currencyRate = (requestCurrencyAmount + currencyTip + taxCurrency) / totalPayUSDC
				const requestUSDAmount = currencyRate > 0 ? requestCurrencyAmount / currencyRate : 0

				const totalPayCurrency = totalPayUSDC * currencyRate
				const feeCurrency = feeUSDC * currencyRate
				const USDCTip = currencyRate ? currencyTip / currencyRate : 0
				const receivedUSDC = totalPayUSDC - feeUSDC
				const receivedCurrency = receivedUSDC * currencyRate
				const taxUSDC = currencyRate ? taxCurrency / currencyRate : 0
				const title = kkk?.title
				const textNote =
				_requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : ""

				requestDetail = {
					requestCurrency,
					totalPayUSDC,
					totalPayCurrency,
					requestCurrencyAmount,
					requestUSDAmount,
					feeUSDC,
					feeCurrency,
					currencyTip,
					USDCTip,
					taxUSDC,
					taxCurrency,
					receivedUSDC,
					receivedCurrency,
					rate: currencyRate,
					code: kkk?.code,
					title,
					textNote
				}
			}

			} catch {
				requestCurrency = tail as ICurrency
			}

			const ret: TransferHistork = {
			date: Number(n.issueTimestamp * BigInt(1000)),
			amount: payAmount - (requestDetail?.feeUSDC || 0),
			address: account,
			hash: n.successAuthorizationHash.startsWith("0x00") ? n.payHash : n.successAuthorizationHash,
			note: n.node,
			type,
			mode: "request",
			fee: 0,
			type1: type === "sent" ? "paid" : type === "pending" ? "" : "received",
			preAmount: payAmount,
			requestCurrency,
			requestDetail,
			group
			}

			return ret
		})

		mappedLinks = mappedLinks.filter(n => !!n?.requestDetail)

		const checks: CheckHistory[] = _checks[1]
		const memoSelfDeposited: Map<string, boolean> = new Map()

		const mappedChecks: TransferHistork[] = await Promise.all(
			checks.map(async n => {
				const text = (n.node || "").split("\r\n")
				const encryptedText = text[1]
				
				let requestDetail: IRequestCurrencyDetail | undefined
				let ce: { secureCode: string; passcode: string } | undefined
				try {
					const cleanText = encryptedText ? await aesGcmDecrypt(encryptedText, profile.privateKeyArmor) : undefined
					if (cleanText) ce = JSON.parse(cleanText)
				} catch {}

				const isCreator = n.from.toLowerCase() === myAddrLocal
				const isreceiver = n.to.toLowerCase() === myAddrLocal
				

				const account = n.to.toLowerCase() !== ethers.ZeroAddress ? n.to.toLowerCase() : ''

				const type: HistoryFilter = !account ? "pending" : isCreator ? "completed" : "deposited"


				const totalPayUSDC = Number(ethers.formatUnits(n.amount, 6))
				const costUSDC = calcFeeFromReceived(totalPayUSDC)
				let amount = type === 'deposited' ? totalPayUSDC - costUSDC : totalPayUSDC

				let hash = type === 'pending' ? n.successAuthorizationHash : n.depositHash

				let type1: HistoryFilter = type === "deposited" ? "received" : "sent"

				const {noteText, card, payme}:ParsedNote = parseNodeEX(n.node)


				
					const feeUSDC = costUSDC
					const requestCurrencyAmount = Number(payme?.currencyAmount || 0)
					const requestUSDAmount = totalPayUSDC - feeUSDC
					
					
					const currencyRate = requestCurrencyAmount / requestUSDAmount

					const feeCurrency = feeUSDC * currencyRate

					const totalPayCurrency = totalPayUSDC * currencyRate
					
					const receivedCurrency = requestCurrencyAmount
					
					const title = payme?.title
					
					

					requestDetail = {
						requestCurrency: payme?.currency || "USDC",
						totalPayUSDC,
						totalPayCurrency,
						requestCurrencyAmount,
						requestUSDAmount,
						feeUSDC: type === 'deposited' ? 0 : feeUSDC,
						feeCurrency: type === 'deposited' ? 0 : feeCurrency,
						currencyTip: 0,
						USDCTip: 0,
						taxUSDC: 0,
						taxCurrency: 0,
						receivedUSDC: type === 'deposited' ? 0 : requestUSDAmount,
						receivedCurrency: type === 'deposited' ? 0 : receivedCurrency,
						rate: currencyRate,
						title,
						textNote: noteText
					}
				

					return {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						address: account ? account.toLowerCase() : "",
						hash,
						note: n.node,
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: "cashcode",
						fee: costUSDC,
						type1,
						preAmount: totalPayUSDC,
						card,
						payme,
						requestDetail
					}
				}
			)
		)

		const merged = [...mappedPay, ...mappedLinks, ...mappedChecks].sort((a, b) => b.date - a.date)
		setAllItems(merged)
		} finally {
		setLoading(false)
		}
	}, [profiles, myAddress, setMyAddress])

	// 获取 AA 账号的 USDC balance。RPC 熔断或失败时走 API
	const loadAaAccountBalanceInFlightRef = useRef<Promise<void> | null>(null)
	const loadAaAccountBalance = useCallback(async () => {
		const aa = profiles?.[0]?.aaAccount
		if (!aa) {
			setAaAccountUsdcBalance('0')
			return
		}
		if (loadAaAccountBalanceInFlightRef.current) {
			await loadAaAccountBalanceInFlightRef.current
			return
		}
		const run = async () => {
			try {
				// 限流时仅用 CoNET 节点，baseEndpoint 内部会走 CoNET-only
				const usdcContract = new ethers.Contract(USDCContract_BASE, usdc_abi, baseEndpoint)
				const balanceRaw = await usdcContract.balanceOf(aa)
				setAaAccountUsdcBalance(ethers.formatUnits(balanceRaw, 6))
			} catch (e) {
				if (isRpcQuotaOrNetworkError(e)) reportRpcFailure()
				if (!isRpcDegraded()) {
					const bal = await getUsdcBalanceFromApi(aa)
					if (bal != null) setAaAccountUsdcBalance(bal)
				}
			} finally {
				loadAaAccountBalanceInFlightRef.current = null
			}
		}
		loadAaAccountBalanceInFlightRef.current = run()
		await loadAaAccountBalanceInFlightRef.current
	}, [profiles])

	useEffect(() => {
		if (!myAddress && profiles?.[0]?.keyID) setMyAddress(profiles[0].keyID)
		if (myAddress) getBalanceProcess(myAddress, setUsdcbalance, setUsdcToUSD)
		loadAaAccountBalance()
	}, [myAddress, profiles, setMyAddress, setUsdcbalance, setUsdcToUSD, loadAaAccountBalance])

	useEffect(() => {
		load()
	}, [load])

	// Tab 2 (Express Pay)：拉取 CCSA 卡资产，供 ActiveList 展示活动
	useEffect(() => {
		if (activeSlide !== 1 || !profiles?.[0] || !CCSA_Card_Address) return
		getMyAssets(profiles[0], CCSA_Card_Address)
			.then((assets) => { if (assets) setSmartAccountCardAssets(assets) })
			.catch(() => setSmartAccountCardAssets(null))
	}, [activeSlide, profiles])

	const activePending = useMemo(() => {
		return allItems
		.filter(tx => {
			const isPending = tx.type === "pending"
			const isRequestActive = tx.mode === "request" && tx.type === "sent"
			const isCashcodeReady = tx.mode === "cashcode" && tx.type === "pending"
			return isPending || isRequestActive || isCashcodeReady
		})
		.slice(0, 3)
	}, [allItems])

	const history = useMemo(() => {
		return allItems
		.filter(tx => {
			// if (tx.mode === "pay") return tx.type1 !== ""
			// if (tx.mode === "request") return tx.type !== "pending"
			// if (tx.mode === "cashcode") return tx.type !== "pending"
			return tx.type1 ==='received' || tx.type1 === 'sent'
		})
		.slice(0, 6)
	}, [allItems])

  	const reflashProcess = async () => {
		if (reflash) return
		const profile: profile = profiles[0]
		setReflash(true)

		await getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
		await loadAaAccountBalance()
		// 刷新 CCSA 资产
		if (profiles?.[0] && CCSA_Card_Address) {
			try {
				const assets = await getMyAssets(profiles[0], CCSA_Card_Address)
				if (assets) setSmartAccountCardAssets(assets)
			} catch (e) {
				console.error('Failed to refresh CCSA assets:', e)
				setSmartAccountCardAssets(null)
			}
		}
		setReflash(false)
	}

	/** 延迟 5 秒后刷新 AA 资产（USDC 余额 + CCSA 卡资产），用于支付成功返回父页面后更新展示 */
	const scheduleRefreshAAAssets = useCallback(() => {
		if (refreshAAAssetsTimeoutRef.current) clearTimeout(refreshAAAssetsTimeoutRef.current)
		refreshAAAssetsTimeoutRef.current = setTimeout(() => {
			refreshAAAssetsTimeoutRef.current = null
			loadAaAccountBalance()
			if (profiles?.[0] && CCSA_Card_Address) {
				getMyAssets(profiles[0], CCSA_Card_Address)
					.then((assets) => { if (assets) setSmartAccountCardAssets(assets) })
					.catch(() => setSmartAccountCardAssets(null))
			}
		}, 5000)
	}, [loadAaAccountBalance, profiles])

  return (
    <div
      className="
        w-full h-full min-h-0
        flex flex-col
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        pt-[calc(env(safe-area-inset-top)+0.75rem)]
        pb-[calc(env(safe-area-inset-bottom)+5.5rem)]
      "
    >
      {/* Top bar */}
      <div className="px-5 flex items-center justify-between min-h-[2.125rem]">
        <div className="text-[18px] font-semibold text-slate-900 dark:text-slate-100 leading-none">
          My Wallet
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm ring-1 ring-black/5 dark:ring-white/10 shrink-0">
          <Zap size={14} className="fill-amber-400 text-amber-400" />
          <span>Gas Sponsored</span>
        </div>
      </div>

		{/* 钱包卡片轮播区 */}
		<div className="relative px-6 mt-4 mb-6">
			<div
				ref={carouselRef}
				className="flex gap-4 overflow-x-hidden snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				onMouseDown={onMouseDown}
				onMouseMove={onMouseMove}
				onMouseUp={onMouseUp}
				onMouseLeave={onMouseLeave}
				onMouseEnter={(e) => {
					// 鼠标进入时，阻止事件冒泡
					e.stopPropagation()
				}}
				onWheel={(e) => {
					// React 合成事件层面也阻止默认行为
					e.preventDefault()
					e.stopPropagation()
				}}
			>
				{/* Card 1: USDC on Base */}
				<div
					className={`w-full flex-shrink-0 transition-transform duration-500 ease-out ${activeSlide === 1 ? '-translate-x-[105%]' : 'translate-x-0'}`}
					onClick={() => setActiveSlide(0)}
				>
					<div
						className="
						relative
						w-full
						h-[15rem]
						rounded-3xl
						bg-gradient-to-br from-[#1b6dff] via-[#6d3dff] to-[#f54b8b]
						p-6
						shadow-xl
						overflow-hidden
						text-white
						flex flex-col justify-between
						"
					>
						<div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" aria-hidden />
						
						<div className="flex justify-between items-center z-10">
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60 disabled:active:scale-100"
									onClick={(e) => {
										e.stopPropagation()
										reflashProcess()
									}}
									disabled={reflash}
									aria-label="Refresh"
								>
									<img
										src={base_icon}
										alt="Base"
										className={["w-5 h-5 object-contain", reflash ? "animate-spin opacity-80" : ""].join(" ")}
									/>
								</button>
								<span className="font-medium">USDC on Base</span>
							</div>
						</div>

						<div className="text-center z-10 mt-4">
							<div className="text-5xl font-bold tracking-tight tabular-nums">
								{formatWithThousands(usdcbalance)} <span className="text-2xl font-normal opacity-80">USDC</span>
							</div>
							<div className="text-white/70 mt-1 text-sm tabular-nums">
								≈ {fiatPrefix("CAD")} {formatWithThousands(balanceFiat)}
							</div>
						</div>

						{/* 地址显示 - 左下角 */}
						{myAddress && (
							<div className="flex justify-start mt-auto z-10">
								<button
									type="button"
									onClick={() => copyAddress(myAddress, 'eoa')}
									className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors"
								>
									{`${myAddress.slice(0, 6)}...${myAddress.slice(-4)}`}
									{addressCopied === 'eoa' ? (
										<Check size={10} className="text-emerald-400 shrink-0" />
									) : (
										<Copy size={10} />
									)}
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Card 2: Smart Account 钱包卡片 */}
				<div
					className={`absolute top-0 left-6 right-6 transition-transform duration-500 ease-out ${activeSlide === 1 ? 'translate-x-0' : 'translate-x-[105%]'}`}
					onClick={() => setActiveSlide(1)}
				>
					{!profiles?.[0]?.aaAccount ? (
						// 未激活状态
						<button
							type="button"
							onClick={() => navigate("/express")}
							className="relative w-full h-[15rem] rounded-3xl p-6 text-white shadow-lg bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col justify-center items-center cursor-pointer overflow-hidden border-2 border-dashed border-slate-600 group hover:border-purple-400 transition-colors"
						>
							<div className="absolute inset-0 bg-purple-600/10 group-hover:bg-purple-600/20 transition-colors pointer-events-none" aria-hidden />
							<div className="z-10 bg-white/10 p-4 rounded-full mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
								<Plus size={32} className="text-purple-300" />
							</div>
							<h3 className="text-xl font-bold z-10">Create Express Pay</h3>
							<p className="text-slate-400 text-sm mt-2 z-10 text-center px-8">Unlock gas-free payments & exclusive vouchers</p>
						</button>
					) : (
						// 已激活状态
						<div className="relative w-full h-[15rem] rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-500 flex flex-col justify-between overflow-hidden">
							<div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl pointer-events-none" aria-hidden />
							
							<div className="flex justify-between items-center z-10">
								<div className="flex items-center gap-2">
									<button
										type="button"
										className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/60 bg-white/20 backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60 disabled:active:scale-100"
										onClick={(e) => {
											e.stopPropagation()
											reflashProcess()
										}}
										disabled={reflash}
										aria-label="Refresh"
									>
										<img
											src={base_icon}
											alt="Base"
											className={["w-5 h-5 object-contain", reflash ? "animate-spin opacity-80" : ""].join(" ")}
										/>
									</button>
									<span className="font-medium">Express Pay</span>
								</div>
							</div>

							<div className="text-center z-10 mt-4">
								<div className="text-5xl font-bold tracking-tight tabular-nums">
									{formatWithThousands(aaAccountUsdcBalance)} <span className="text-2xl font-normal opacity-80">USDC</span>
								</div>
								<div className="text-white/70 mt-1 text-sm tabular-nums">
									≈ {fiatPrefix("CAD")} {formatWithThousands(Number(aaAccountUsdcBalance) * fxRateUSDCToCurrency("CAD"))}
								</div>
							</div>

							{/* 地址显示 - 左下角 */}
							{profiles?.[0]?.aaAccount && (
								<div className="flex justify-start mt-auto z-10">
									<button
										type="button"
										onClick={() => copyAddress(profiles[0].aaAccount, 'aa')}
										className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors"
									>
										{`${profiles[0].aaAccount.slice(0, 6)}...${profiles[0].aaAccount.slice(-4)}`}
										{addressCopied === 'aa' ? (
											<Check size={10} className="text-emerald-400 shrink-0" />
										) : (
											<Copy size={10} />
										)}
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{/* 分页指示器 */}
			<div className="flex justify-center gap-2 mt-6">
				<button
					type="button"
					onClick={() => setActiveSlide(0)}
					className={`h-2 rounded-full transition-all duration-300 ${activeSlide === 0 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300'}`}
					aria-label="USDC on Base"
				/>
				<button
					type="button"
					onClick={() => setActiveSlide(1)}
					className={`h-2 rounded-full transition-all duration-300 ${activeSlide === 1 ? 'w-8 bg-purple-600' : 'w-2 bg-slate-300'}`}
					aria-label="Express Pay"
				/>
			</div>
		</div>

		
		{/* Tab 内容区域 - 根据 activeSlide 显示对应内容，带淡入淡出动画 */}
		<AnimatePresence mode="wait">
			{activeSlide === 0 ? (
				/** tab1 container */
				<motion.div
					key="tab1"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
				>
				{/* Actions */}
				<div className="px-8 mt-4">
					<div className="flex items-start justify-between">
					<MiniAction
						label="Send"
						icon={<ArrowUpRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
						onClick={() => {
							setPayScreenMode('eoa-pay')
							setSettingsOpen('Pay')
							setShowFooter(false)
						}}
					/>
					<MiniAction
						label="Request"
						icon={<ArrowDownLeft className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
						onClick={() => {
							setSettingsOpen('BeamioPayMe')
							setShowFooter(false)
						}}
					/>
					<MiniAction
						label="Cashcode"
						icon={<ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
						onClick={() => {
							setSettingsOpen('Cashcode')
							setShowFooter(false)
						}}
					/>
					<MiniAction
						label="Bank"
						icon={<Landmark className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
						onClick={() => {
							setSettingsOpen('BankingBridge')
							setShowFooter(false)
						}}
					/>
					</div>
				</div>

				{/* Lists */}
				<div className="flex-1 min-h-0 overflow-y-auto mt-4">
					{/* Active & Pending */}
					<div className="px-5">
					<div className="flex items-center gap-2 px-2 mb-4">
						<span className="h-1.5 w-1.5 rounded-full bg-[#2F78FF]" />
						<div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
						Active & Pending
						</div>
						{loading && <Loader className="w-3.5 h-3.5 text-slate-400 animate-spin" strokeWidth={2.2} />}
					</div>

					
						{activePending.length ? (
							<>
							<ActivePannel
								items ={activePending}
								onOpen={tx => {
									setItemtx(tx)
									setShowAlphaHowItWorks('TransactionsItemDetail')
									setShowFooter(false)
									
								}}
							/>
						
						
						</>
						) : (
						<div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
							No active items
						</div>
						)}
					
					</div>

					{/* History */}
					<div className="px-5 mt-4">
					<div className="px-2  flex items-center justify-between">
						<div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
							History
						</div>
						<button
						type="button"
						onClick={() => navigate("/HistoryAll")}
						className="text-[12px] font-semibold text-[#2F78FF] active:opacity-70"
						>
							View All
						</button>
					</div>

					<div
						className="
						mt-3 overflow-hidden
						rounded-2xl
						bg-white/85 dark:bg-slate-900/65
						ring-1 ring-black/5 dark:ring-white/10
						shadow-[0_10px_24px_rgba(0,0,0,0.08)]
						"
					>
						{history.length ? (
						history.map(tx => (
							<Row key={`${tx.mode}-${tx.hash}-${tx.date}`} tx={tx} mode={tx.mode} onOpen={(tx) => {
								setShowAlphaHowItWorks('TransactionsItemDetail')
								setItemtx(tx)
								setShowFooter(false)

							}} />
						))
						) : (
						<div className="px-4 py-5 text-[12px] text-slate-500 dark:text-slate-400">
							No history yet
						</div>
						)}
					</div>

					</div>

				</div>
			</motion.div>
			) : (
				/** tab2 container */
				<motion.div
					key="tab2"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
				>
				{/* Tab 2 内容 - Smart Account 相关内容 */}
				<div className="px-8 mt-4">
					<div className="flex items-start justify-between">
						<MiniAction
							label="Transfer"
							icon={<ArrowUpRight className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
							onClick={() => {
								setPayScreenMode('aa-eoa-transfer')
								setShowFooter(false)
								setSettingsOpen('Pay')
							}}
						/>
						<MiniAction
							label="Pay"
							icon={payMeSigning ? <Loader className="w-5 h-5 text-slate-800 dark:text-slate-100 animate-spin" strokeWidth={2.4} /> : <ScanLine className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
							onClick={async () => {
								if (payMeSigning || !profiles?.[0]?.aaAccount || !profiles[0].privateKeyArmor) return
								setPayMeSigning(true)
								try {
									const payload = await signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(profiles[0], '10000', { deadlineSeconds: 3 * 60 })
									setOpenRelayPayload(payload)
									setShowFooter(false)
									setSettingsOpen('BeamioPayMeQR')
								} catch (e) {
									console.error('Pay Me signature failed', e)
								} finally {
									setPayMeSigning(false)
								}
							}}
						/>
						<MiniAction
							label="Pay bill"
							icon={<Banknote className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
							onClick={() => {
								setScanData('')
								setVoucherPayAmount('')
								setVoucherPayToAA('')
								setVoucherPayError('')
								setScanIntent('payBill')
								setShowFooter(false)
								setShowTenKeySlide(true)
							}}
						/>
						<MiniAction
							label="Vouchers"
							icon={<QrCode className="w-5 h-5 text-slate-800 dark:text-slate-100" strokeWidth={2.4} />}
							onClick={() => {
								setScanData('')
								setVoucherPayAmount('')
								setVoucherPayToAA('')
								setVoucherPayError('')
								setScanIntent('')
								setShowFooter(false)
								setShowTenKeySlide(true)
							}}
						/>
					</div>
				</div>

				{/* Smart Account Account Assets - only show if AA account exists */}
				{profiles?.[0]?.aaAccount && (
					<div className="px-5 mt-4">
						<div className="flex items-center gap-2 px-2 mb-3">
							<span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
							<span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">ACCOUNT ASSETS</span>
						</div>
						<div className="rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.08)] overflow-hidden">
							<div className="p-4 space-y-4">
								{/* USDC */}
								<div className="flex items-center gap-3">
									<div className="flex-shrink-0 w-11 h-11 flex items-center justify-center">
										<div className="relative flex-shrink-0 min-w-[16px] min-h-[16px]">
											<img src={usdc_icon} alt="USDC" className="block w-8 h-8 rounded-full object-contain" />
											<img src={base_icon} alt="Base" className="block w-5 h-5 absolute -bottom-0.5 -right-0.5 rounded-full border border-white dark:border-slate-900 bg-white" />
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">USDC</p>
										<p className="text-sm text-slate-500 dark:text-slate-400">Base Network</p>
									</div>
									<div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums text-[15px]">{formatWithThousands(aaAccountUsdcBalance)}</div>
								</div>
								{/* CCSA - show if CCSA assets exist (points > 0) or if there are NFTs */}
								{smartAccountCardAssets && (
									(smartAccountCardAssets.points && Number(smartAccountCardAssets.points) > 0) ||
									(smartAccountCardAssets.nfts && smartAccountCardAssets.nfts.length > 0)
								) && (() => {
									// 查找 tokenId > 0 的 NFT
									const nftWithIdGreaterThanZero = smartAccountCardAssets.nfts?.find(nft => Number(nft.tokenId) > 0)
									const hasActiveNFT = !!nftWithIdGreaterThanZero
									return (
										<div className="flex items-start justify-between gap-3 pt-0">
											<div className="flex-1 min-w-0 leading-[1rem]">
												<p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">CCSA Membership</p>
												<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
													Balance: CA$ {formatAmount(smartAccountCardAssets.points || '0', 'CAD')}
												</p>
											</div>
											{hasActiveNFT && (
												<div className="flex flex-col items-end shrink-0">
													<p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Active</p>
													<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
														#{nftWithIdGreaterThanZero.tokenId}
													</p>
												</div>
											)}
										</div>
									)
								})()}
								{/* No vouchers yet - only show if no CCSA assets and no NFTs */}
								{(!smartAccountCardAssets || 
									((!smartAccountCardAssets.points || Number(smartAccountCardAssets.points) === 0) && 
									 (!smartAccountCardAssets.nfts || smartAccountCardAssets.nfts.length === 0))) && (
									<p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">No vouchers yet. Visit Market to buy.</p>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Smart Account HISTORY（与 CardItem 中 ActiveList 一致） */}
				<div className="flex-1 min-h-0 overflow-y-auto mt-4">
					<div className="px-5">
						<div className="flex items-center justify-between px-2 mb-3">
							<span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200">HISTORY</span>
							<button
								type="button"
								onClick={() => navigate('/HistoryAll')}
								className="text-[12px] font-semibold text-violet-600 dark:text-violet-400 active:opacity-70"
							>
								View All
							</button>
						</div>
						<div>
							<ActiveList
								MyCardAssets={
									smartAccountCardAssets ?? {
										address: '',
										cardAddress: CCSA_Card_Address,
										points: '0',
										cardOwner: null,
										cardCurrency: 'USDC',
										nfts: [],
									}
								}
								onItemClick={(item) => {
									setSelectedActionItem(item)
									setShowFooter(false)
								}}
							/>
						</div>
					</div>
				</div>
			</motion.div>
			)}
		</AnimatePresence>

	  {/* bottom 向上弹出窗口: 避开 footer + iOS 安全区 */}
		<div
			className="
			h-[96px]
			pb-[env(safe-area-inset-bottom)]
			pointer-events-none
			"
		/>


		
			<div
			className={[
				"fixed inset-0 z-40",
				settingsOpen ? "pointer-events-auto" : "pointer-events-none"
			].join(" ")}
			>
				{/* 灰色遮罩：父页面不可用 */}
				<div
					className={[
					"absolute inset-0",
					"bg-black/50 transition-opacity duration-300 ease-out",
					settingsOpen ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => {
						setShowFooter(true)
						setSettingsOpen('')
						setOpenRelayPayload(null)
						setSecureCode('')
						setRedeemCode('')
					}}
				/>

				{/* Bottom Sheet：全宽，从底部上来 */}
				<div
					className={[
					"absolute inset-x-0 bottom-0",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体：h-auto 自适应内容高度 */}
					<div
					className={[
						"w-full",
						"bg-white dark:bg-slate-900",
						"rounded-t-[22px]",
						"shadow-[0_-12px_40px_rgba(0,0,0,0.18)]",

						// ✅ 自适应高度，但最多不超过屏幕（避免顶到状态栏）
						// 你也可以改成 90dvh
						"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
						"h-auto",

						// ✅ 安全区：底部留出 Home indicator
						"pb-[env(safe-area-inset-bottom)]"
					].join(" ")}
					>
						{/* 顶部拖拽条（可选） */}
						<div className="pt-2 pb-1 flex justify-center">
							<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
						</div>


						{/* 内容区：内容少就不滚动；内容多才滚动 */}
						<div className="px-4 pb-4 overflow-y-auto">
							{settingsOpen === "Pay" && (
								<PayScreen
									mode={payScreenMode}
									beamioer={historyPayData||undefined}
									close={(path) => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
									aaAccountUsdcBalance={aaAccountUsdcBalance}
								/>
							)}
							{
								settingsOpen === 'BeamioPayMe' && 
								<PaymentLink 
									
									close={() => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
								/>
							}
							{
								settingsOpen === 'BeamioPayMeQR' && openRelayPayload != null && (
									<BeamioPayMe
										showActiveTab={false}
										relayPayload={openRelayPayload}
										onClose={() => {
											setOpenRelayPayload(null)
											setShowFooter(true)
											setSettingsOpen('')
										}}
									/>
								)
							}

							{
								settingsOpen === 'Cashcode' && 
								<Cashcode 
									close={() => {
										setShowFooter(true)
										setSettingsOpen('')
									}}
									
								/>
							}
							{
								settingsOpen === 'BankingBridge' && 
								<BankingBridge 
									onAddCash={() => {

									}}
									onCashOut={() => {

									}}
									
								/>
							}

							{
								settingsOpen === 'RedeemScreen' && 
								<RedeemScreen 
									close={() => {
										setShowFooter(true)
										setSecureCode('')
										setRedeemCode('')
										setSettingsOpen('')
									}}
								/>
							}
							<div
								className="
								h-[24px]
								pb-[env(safe-area-inset-bottom)]
								pointer-events-none
								"
							/>
						</div>
					</div>
				</div>
			</div>

	  {showTenKeySlide && createPortal(
			<AnimatePresence>
				<motion.div
					key="tenkey-slide"
					className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "100%" }}
					transition={{ duration: 0.28, ease: "easeOut" }}
					onTouchMove={(e) => e.stopPropagation()}
				>
					<BeamioNavBack
						title=""
						onClose={() => {
							setShowTenKeySlide(false)
							setShowFooter(true)
						}}
						onMore={() => {}}
					/>
					<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
						<TenKeyInput
							onPaymentSuccess={() => {
								setShowTenKeySlide(false)
								setShowFooter(true)
								scheduleRefreshAAAssets()
							}}
						/>
					</div>
				</motion.div>
			</AnimatePresence>
			, document.body
		)}

	  {(showAlphaHowItWorks || selectedActionItem) && createPortal(
			<AnimatePresence>
				<motion.div
					key="modal-overlay"
					className="
						fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
					"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "100%" }}
					transition={{ duration: 0.28, ease: "easeOut" }}
					onTouchMove={(e) => e.stopPropagation()}
				>
				{/* 顶部 Header */}
				<BeamioNavBack
					title=''
					onClose={() => {
						setShowAlphaHowItWorks('')
						setSelectedActionItem(null)
						setShowFooter(true)
					}}
					onMore={() => {}}
				/>

					{/* 内容区域 */}
					<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
						{showAlphaHowItWorks === 'TransactionsItemDetail' && itemTx && (
							<TransactionsItemDetail
								localMode='pay' tx={itemTx}
							/>
						)}
						{selectedActionItem != null && (
							<ActionItemDetail
								item={selectedActionItem}
								memberNo={String(smartAccountCardAssets?.nfts?.length ?? 0)}
								onClose={() => {
									setSelectedActionItem(null)
									setShowFooter(true)
								}}
							/>
						)}
					</div>
				</motion.div>
			</AnimatePresence>
			, document.body
		)}



    </div>
  )
}