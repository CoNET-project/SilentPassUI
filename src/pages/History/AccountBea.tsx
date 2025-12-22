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

type Prof = {
	address: string
	note: string
	dateData: string
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

const SenderBmo = ({address, note, dateData}: Prof) => {
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers } = useDaemonContext()
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()

	const findUser = async () => {
		if (fromBeamio) return

		let account = beamioUsers.find(n => n?.address === address)
		if (!account) {
			const _account = await searchUsername(address)
			if (_account) {
				const acc = _account.results
				setbBeamioUsers([...beamioUsers, acc[0]])
				setfromBeamio({...acc[0]})
			}
			return
		}
		setfromBeamio({...account})
		
	}
	useEffect(() => {
		findUser()
		
	}, [])

	const fallback = typeof getImg === 'function' ? getImg(fromBeamio?.image||'') : ''

	
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