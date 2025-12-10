import React, {useEffect, useState} from "react"
import { searchResult } from "./SearchBarWithResults"
import { X, Copy } from "lucide-react"
import { getFollowStatus, removeFollowing as removeFollowingProcess, addFollowing} from '@/services/beamio'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { AppButton } from "../button/AppButton"
type Props = {
  	item: searchResult|null
	close: () => void
}

const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`

const shortenAddress = (addr: string) => {
	if (!addr) return ""
	if (addr.length <= 10) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const buildDisplayName = (item: searchResult) => {
	const first = item.first_name?.trim()
	const last = item.last_name?.trim()

	if (first || last) {
		return [first, last].filter(Boolean).join(" ")
	}
	if (item.username) {
		return item.username
	}
	return shortenAddress(item.address)
}

const buildAvatarText = (item: searchResult) => {
	const first = item.first_name?.trim()
	const last = item.last_name?.trim()

	if (first && last) return (first[0] + last[0]).toUpperCase()
	if (first) return first[0].toUpperCase()
	if (item.username) return item.username[0]?.toUpperCase() || "?"
	if (item.address) return item.address[2]?.toUpperCase() || "?"
	return "?"
}

const formatCount = (value: string | undefined) => {
	const n = Number(value ?? 0)
	if (!Number.isFinite(n) || n <= 0) return "0"
	if (n >= 1_000_000)
		return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
	if (n >= 1_000)
		return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
	return String(n)
}

const buildCreatedAtLabel = (created_at?: number) => {
	if (!created_at) return ""
	let ts = created_at

	// 粗略兼容秒 / 毫秒：10 位当秒处理
	if (String(created_at).length === 10) {
		ts = created_at * 1000
	}

	const d = new Date(ts)
	if (Number.isNaN(d.getTime())) return ""

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
  })
}

type ContactRowProps = {
	title: string
	subtitle: string
	amount: string
}

type followStatus = {
	isFollowing: boolean
	followers: []
	following: []
	isFollowedBy: boolean
	followerCount: number
	followingCount: number
}

const ContactRow = ({ title, subtitle, amount }: ContactRowProps) => {
  const isIn = amount.startsWith("+")
  const clean = amount.replace("+", "").replace("-", "")

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <div>
        <div className="text-[13px] font-medium text-slate-900">{title}</div>
        <div className="text-[10px] text-slate-500">{subtitle}</div>
      </div>
      <div
        className={
          "text-[12px] font-semibold " +
          (isIn ? "text-emerald-600" : "text-slate-900")
        }
      >
        {isIn ? "+" : "−"}
        {clean} USDC
      </div>
    </div>
  )
}

export default function BeamioContactProfilePreview({ item, close }: Props) {
	// 先准备默认的占位文案，用于 item 还没选中的时候
	let displayName = "Contact"
	let avatarText = "?"
	let usernameLabel = "@username"
	let createdAtLabel = ""

	const [isFollowing, setIsFollowing] = useState<boolean>(false)
	const [isFollowedBy, setIsFollowedBy] = useState<boolean>(false)
	const [followerCount, setFollowerCount] = useState<number>(0)
	const [followingCount, setFollowingCount] = useState<number>(0)
	const [removeFollowing, setRemoveFollowing] = useState<boolean>(false)
	const [loading, setLoading] = useState<boolean>(false)
	const [processError, setProcessError] = useState<string>('')

	const { profiles,
		} = useDaemonContext()

	if (item) {
		displayName = buildDisplayName(item)
		avatarText = buildAvatarText(item)
		usernameLabel = item.username
			? `@${item.username}`
			: shortenAddress(item.address)

		createdAtLabel = buildCreatedAtLabel(item.created_at)

	}

	const catchClick = async () => {

		//		reomve following
		if (isFollowing) {
			if (!removeFollowing) {
				setRemoveFollowing(true)
				return
			}
			setRemoveFollowing(false)
			setLoading(true)
			const result = await removeFollowingProcess(profiles[0].privateKeyArmor, item!.address)
			setLoading(false)
			if (result) {
				setIsFollowing(false)
				setFollowerCount(Math.max(0, followerCount - 1))
				return
			}
			setProcessError('Error!, try again later.')
			return
		}
		// add following
		
		setLoading(true)
		const result = await addFollowing(profiles[0].privateKeyArmor, item!.address)
		setLoading(false)
		if (result) {
			setIsFollowing(true)
			setFollowerCount(followerCount + 1)
			return
		}
		setProcessError('Error!, try again later.')	

	}
	let statusProcess = false
	const getFollowInfo = async () => {

		if (item && profiles.length>0 && !statusProcess) {
			statusProcess = true
			const res: followStatus|null = await getFollowStatus(profiles[0].keyID, item.address)
			if (!res) return

			setFollowerCount(res.followerCount)
			setFollowingCount(res.followingCount)
			setIsFollowedBy(res.isFollowedBy)	
			setIsFollowing(res.isFollowing)
			console.log('getFollowInfo', res)
		}
	}

	useEffect(() => {
		getFollowInfo()
	},[])

	useEffect(() => {
		if (processError) {
			const timer = setTimeout(() => {
				setProcessError('')
			}, 3000)

			return () => clearTimeout(timer)
		}
	},[processError])


	return (
		<div className="relative w-full h-11">
		{/* 顶部蓝色区域：头像 + 名字 */}
		<div 
			className="
				relative z-10
				bg-gradient-to-r from-sky-500 to-blue-600 text-white
				px-5 pt-3 pb-10
				rounded-b-[28px]
				shadow-[0_8px_24px_rgba(15,23,42,0.35)]
			">

			{/* 导航 */}
				<div className="flex items-center justify-between mb-4">
					<div className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/80">
						Contact
					</div>

					<button 
						className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"
						onClick={close}
					>
						<X className="w-4 h-4 text-white/90" strokeWidth={2} />
					</button>
				</div>

			{/* 头像 + 名字 + username + Add friend */}
			<div className="flex flex-col items-center text-center">
			{/* 头像 */}
			{item?.image ? (
				<img
					src={item.image}
					alt={item.username}
					className="w-20 h-20 rounded-full object-cover mr-2 flex-shrink-0"
				/>
				) : (
				<img
					src={getImg(item?.username)}
					alt={item?.username}
					className="w-20 h-20 rounded-full object-cover mr-2 flex-shrink-0 bg-slate-200"
				/>
			)}


				{/* @username */}
				<div className="mt-4 text-[18px] font-semibold tracking-tight">
					{usernameLabel}
				</div>

				 {/* createdAtLabel */}
					{createdAtLabel && (
						<div className="mt-1 text-[11px] text-white/75">
						On Beamio since {createdAtLabel}
						</div>
					)}

					{/* isFollowedBy */}
					{isFollowedBy && (
						<div className="mt-0.5 text-[11px] text-white/80">
						Followed by {isFollowedBy}
						{/* 如果 isFollowedBy 是 boolean，可以改成：
							{isFollowedBy && 'Follows you'} */}
						</div>
					)}

				{/* 地址 pill + 复制按钮 */}
				{item && (
					<button
						type="button"
						className="
						mt-3 inline-flex items-center gap-2
						px-4 py-1.5 rounded-full
						bg-white/20 text-[12px] font-medium text-white/95
						backdrop-blur-sm
						"
						onClick={() => {
						if (navigator?.clipboard && item.address) {
							navigator.clipboard.writeText(item.address).catch(() => {})
						}
						}}
					>
						<span className="tracking-wide">
								{shortenAddress(item.address)}
						</span>
						<span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
							<Copy className="w-3.5 h-3.5 text-white/95" strokeWidth={2} />
						</span>
					</button>
				)}

				{/* Following / Followers 统计 */}
				<div className="mt-4 flex items-center justify-center gap-10 text-[11px] text-white/80">
					<div className="flex flex-col items-center">
						<span className="text-[15px] font-semibold text-white">
							{followingCount}
						</span>
						<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
							Following
						</span>
					</div>

					<div className="w-px h-8 bg-white/30" />

					<div className="flex flex-col items-center">
						<span className="text-[15px] font-semibold text-white">
							{followerCount}
						</span>
						<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
							Followers
						</span>
					</div>
				</div>

				{/* Follow 按钮 */}
				<AppButton

					variant={ isFollowing && !removeFollowing ? 'primary' : 'secondary' }
					onClick={catchClick}
					loading={loading}
					className="
						mt-6 px-10 py-2.5 rounded-full
						bg-white text-[14px] font-semibold text-sky-700
						shadow-md
					"
				>
					{ isFollowing ? removeFollowing ? 'Remove following' : 'following' : 'Follow' }
				</AppButton>
			</div>
		</div>

		{/* 主体内容 */}
		<div 
			className="
				relative z-0
				flex-1 bg-white
				-mt-12           /* 让白色卡片往上贴住蓝色 */
				px-5 pt-20 pb-5 /* 用更大的 pt 把内容往下推开，避免和 Add friend 重叠 */
				flex flex-col gap-4
				rounded-t-[28px]
				shadow-[0_-4px_16px_rgba(15,23,42,0.12)]
			"
			>
			{/* 主操作按钮：Pay / Request / Chat */}
			<div className="grid grid-cols-3 gap-2">
				<button className="py-2.5 rounded-full bg-sky-600 text-white text-[13px] font-semibold shadow-sm">
					Pay
				</button>
				<button className="py-2.5 rounded-full bg-sky-50 text-sky-700 text-[13px] font-semibold border border-sky-100">
					Request
				</button>
				<button className="py-2.5 rounded-full bg-slate-50 text-slate-800 text-[13px] font-medium border border-slate-200">
					Chat
				</button>
			</div>

			{/* Follow / Follower 简单 stats */}


			{/* 最近往来记录（简短版） */}
			<div className="mt-2">
				<div className="flex items-center justify-between mb-2">
					<div className="text-[11px] font-medium tracking-[0.16em] uppercase text-slate-500">
					Between you
					</div>
					<button className="text-[11px] text-sky-600 font-medium">
					See all
					</button>
				</div>

				<div className="space-y-2.5">
					<ContactRow
						title="You paid 1.00 USDC"
						subtitle={`${displayName} · Direct send`}
						amount="-1.00"
					/>
					<ContactRow
						title="You requested 1.00 USDC"
						subtitle={`${displayName} · Payment link · Paid`}
						amount="+1.00"
					/>
				</div>
			</div>
		</div>
		</div>
	)
}

