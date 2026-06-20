import { IpfsImg } from '@/components/IpfsImg';
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt, searchUsername} from '@/services/beamio'
import {urlToObjectUrl, useObjectImgSrc} from '@/components/card/useObjectImgSrc'
import { User } from "lucide-react"
import {ethers} from 'ethers'
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader,ChevronLeft,
  ArrowUpRight, ArrowDownLeft,} from "lucide-react"
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'

import {fiatPrefix, formatAmount, formatTimev2, statusStyleMap} from '@/services/currency'
import { tu } from '@/locale/beamioLocale'

type Prof = {
	address: string
	tx: TransferHistork
}
function formatUsdc2(n: number) {
	const v = Number.isFinite(n) ? n : 0
	return v.toFixed(2)
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

const unknowAcc = (address: string):searchResult => {
	const ret: searchResult = {
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: '未知',
		image: ''
	}
	return ret
}


const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const ListHeader = ({address, tx}: Prof) => {
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers } = useDaemonContext()
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const [userImg, setUserImg] = useState('')
	const textColor = statusStyleMap[tx.type as HistoryFilter].text
	const findingRef = useRef(false)

	const findUser = useCallback(async () => {
		if (findingRef.current) return
		if (fromBeamio) return

		findingRef.current = true
		try {
			let account = beamioUsers.find(n => (n?.address || '').toLowerCase() === address.toLowerCase())

			if (!account) {
				const _account = await searchUsername(address)
				if (_account?.results?.[0]) account = _account.results[0]
			}

			if (!account) {
				account = unknowAcc(address) 
			} else {
				if (!account?.image) {
					account.image = getImg(account.username)
				}
			}
			//@ts-ignore
			setbBeamioUsers(prev => {
			const addr = (account?.address || '').toLowerCase()
			//@ts-ignore
			if (prev.some(u => (u.address || '').toLowerCase() === addr)) return prev
				return [...prev, account!]
			})
			
			setfromBeamio(account)

			setUserImg(account.image||getImg(account.username))
		} finally {
			findingRef.current = false
			
		}
	}, [address, beamioUsers, fromBeamio, setbBeamioUsers])

	useEffect(() => {
		findUser()
	}, [findUser])

	const d = tx.requestDetail
	const currency: ICurrency = !d ? 'USDC' : d.requestCurrency
	
	const receivedCurrency = d ? (d.receivedCurrency - (d.taxCurrency||0)) : 0

	const showAmount = tx.type === 'pending' ? d?.requestCurrencyAmount||0 : receivedCurrency

	return (
			<div
				key={fromBeamio?.address}
				className="
					w-full
					flex items-center gap-1
					
					
					px-2 py-1
					text-left
					active:scale-[0.98]
					transition
				"
				>
				{/* Avatar */}
				

				{/* 左侧：用户名 / @handle */}
				<span className="flex-1 min-w-0 leading-tight">
					<span className={`block text-[14px] ${textColor} truncate leading-tight font-medium`}>
						{fiatPrefix(currency)} {formatAmount(showAmount, currency)} 
					</span>
					{/* {
						fromBeamio?.username !=='未知' ? <span className="block text-[10px] text-slate-500 truncate leading-tight">
							@{fromBeamio?.username}
						</span> : (
							<span className="block text-[10px] text-slate-500 truncate leading-tight">
								{fmtAddr(fromBeamio?.address)}
							</span>
						)
					} */}
					
					<span className="inline-flex items-center gap-1 text-[10px] text-slate-400 truncate leading-tight">
						<span>{formatTimev2(tx.date)}</span>

						{/* {localMode === "pay" && (
							<span
								className={[
									"inline-flex items-center justify-center",
									"w-6 h-6",
									tx.type === "sent"
									? "text-rose-600 dark:text-rose-400"   // 🔴 sent
									: "text-emerald-600 dark:text-emerald-400" // 🟢 received
								].join(" ")}
								>
								{tx.type === "sent" ? (
									<ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.2} />
								) : (
									<ArrowDownLeft className="w-3.5 h-3.5" strokeWidth={2.2} />
								)}
								</span>

						)} */}

						
							<span
								className={[
									"inline-flex items-center justify-center",
									"w-6 h-6",
									statusStyleMap[tx.type as HistoryFilter].text,
								].join(" ")}
							>
							{tx.type === 'pending' ? (
								<Loader className="w-3.5 h-3.5" strokeWidth={2} />
							) : (
								<ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
							)}
							</span>
						

						
						{/* <div className="relative w-fit">
							<span
							className={[
								"inline-flex items-center justify-center",
								"w-6 h-6",
								tx.mode === "cashcode"
								? "text-sky-600 dark:text-sky-300"
								: "text-fuchsia-600 dark:text-fuchsia-300"
							].join(" ")}
							>
							<IpfsImg
								src={giftEnvelope}
								className="w-5 block pointer-events-none"
								alt={tu('gift_envelope')}
							/>
							</span>
						</div> */}
				
					</span>
				</span>

				{/* ✅ 右侧：note（最大化显示但不撑破） */}
					<div
						className="
							ml-auto
							flex-shrink-0
							max-w-[45%]
							text-right
						"
					>
						<span
							className="
								block
								truncate
								text-[12px]
								font-normal
								tabular-nums
								text-slate-500   /* 更淡的灰 */
							"
						>
							{tx?.requestDetail?.title}
						</span>
					</div>
				</div>
			)
}

export default ListHeader