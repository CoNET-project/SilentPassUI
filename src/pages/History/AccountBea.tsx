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
import { QrCode, Link as LinkIcon, ZapOff, CalendarCheck, Banknote, HelpCircle, Loader, ArrowUpRight, } from "lucide-react"
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'


type Mode = "pay" | "request" | 'cashcode'
type Prof = {
	address: string
	note: string
	dateData: string
	tx: TransferHistork
	localMode: Mode
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
		username: 'Unknow',
		image: ''
	}
	return ret
}


const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const SenderBmo = ({address, note, dateData, tx, localMode}: Prof) => {
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers } = useDaemonContext()
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const [userImg, setUserImg] = useState('')

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
			account.image && setUserImg(await urlToObjectUrl(account.image))
		} finally {
			findingRef.current = false
			
		}
	}, [address, beamioUsers, fromBeamio, setbBeamioUsers])

	useEffect(() => {
		findUser()
	}, [findUser])

	
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
					{fromBeamio?.username !== 'Unknow' ? (
						
						<img
							src={userImg}
							className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-slate-200"
						/>
					) : (
						<div
						className="
							w-10 h-10
							rounded-full
							flex items-center justify-center
							flex-shrink-0
							bg-slate-200
							text-slate-400
							font-semibold
							text-base
						"
						aria-label="Default avatar"
						>
						?
						</div>
					)}
				

				{/* 左侧：用户名 / @handle */}
				<span className="flex-1 min-w-0 leading-tight">
					<span className="block text-[14px] text-slate-900 truncate leading-tight font-medium">
						{fromBeamio ? displayName(fromBeamio) : ""}
					</span>
					{
						fromBeamio?.username !=='Unknow' ? <span className="block text-[10px] text-slate-500 truncate leading-tight">
							@{fromBeamio?.username}
						</span> : (
							<span className="block text-[10px] text-slate-500 truncate leading-tight">
								{fmtAddr(fromBeamio?.address)}
							</span>
						)
					}
					
					<span className="inline-flex items-center gap-1 text-[10px] text-slate-400 truncate leading-tight">
					<span>{dateData}</span>

					{localMode === "pay" && tx.mode !== "pay" && (
						<span
							className={[
								"inline-flex items-center justify-center",
								"w-6 h-6",
								tx.mode === "cashcode"
								? "text-sky-600 dark:text-sky-300"
								: "text-fuchsia-600 dark:text-fuchsia-300"
							].join(" ")}
						>
						{tx.mode === "cashcode" ? (
							<QrCode className="w-3.5 h-3.5" strokeWidth={2} />
						) : (
							<LinkIcon className="w-3.5 h-3.5" strokeWidth={2} />
						)}
						</span>
					)}

					{localMode === "pay" && tx?.card && (
					<div className="relative w-fit">
						<span
						className={[
							"inline-flex items-center justify-center",
							"w-6 h-6",
							tx.mode === "cashcode"
							? "text-sky-600 dark:text-sky-300"
							: "text-fuchsia-600 dark:text-fuchsia-300"
						].join(" ")}
						>
						<img
							src={giftEnvelope}
							className="w-5 block pointer-events-none"
							alt="Gift Envelope"
						/>
						</span>
					</div>
					)}
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
							{note}
						</span>
					</div>
				</div>
			)
}

export default SenderBmo