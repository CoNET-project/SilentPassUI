import React, {useEffect, useState} from "react"
import { X, Copy, Check, XCircle } from "lucide-react"
import { getFollowStatus, removeFollowing as removeFollowingProcess, addFollowing, AuthorizationSign} from '@/services/beamio'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { AppButton } from "../button/AppButton"
import { useNavigate } from "react-router-dom"
import base_ex from '@/components/assets/base-ex.svg'
import {useAutoFocus} from '@/components/input/useAutoFocus'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import AmountCurrency from '@/components/input/AmountCurrency'
import PayScreen from '@/pages/Pay/send/index'


type Props = {
  	item: searchResult
	close: (path: string|searchResult) => void
}

const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`
const aptEndpoint = 'https://api.settleonbase.xyz'

const shortenAddress = (addr: string) => {
	if (!addr) return ""
	if (addr.length <= 10) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const buildDisplayNameNew = (item: searchResult) => {
	const first = item.first_name?.trim()
	const last = item.last_name?.trim()
	let fullName = ""
	if (first || last) {
		fullName = [first, last].filter(Boolean).join(" ")
	}
	if (item.username) {
		fullName = fullName ? `${fullName} @${item.username}` : `@${item.username}`
		return fullName
	}
	return shortenAddress(item.address)
}

const buildAvatarText = (item: searchResult) => {
	const first = item.first_name?.trim()
	const last = item.last_name?.trim().split('\r\n')[0]

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

const buildCreatedAtLabel = (created_at?: number | string) => {
	if (!created_at) return ""

	// 统一转换成 number
	const num = Number(created_at)
	if (!Number.isFinite(num)) return ""

	// 秒 → 毫秒
	const ts = (String(created_at).length === 10)
		? num * 1000
		: num

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

const defaultNodeText = "Sent with Beamio - no gas fees."


const getDisplayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}


export default function BeamioContactProfilePreview({ item, close }: Props) {

	const navigate = useNavigate()
	// 先准备默认的占位文案，用于 item 还没选中的时候
	let displayName = "Contact"
	let avatarText = "?"
	let usernameLabel = "@BeamioTag"
	let createdAtLabel = ""
	let itemAddress = ''

	const [copied, setCopied] = React.useState(false)
	const [isFollowing, setIsFollowing] = useState<boolean>(false)
	const [isFollowedBy, setIsFollowedBy] = useState<boolean>(false)
	const [followerCount, setFollowerCount] = useState<number>(0)
	const [followingCount, setFollowingCount] = useState<number>(0)
	const [removeFollowing, setRemoveFollowing] = useState<boolean>(false)
	const [loading, setLoading] = useState<boolean>(false)
	const [processError, setProcessError] = useState<string>('')
	const [showChatSendAmount, setShowChatSendAmount] = useState<boolean>(false)
	const [amount, setAmount] = useState('0')
	const [sendError, setSendError] = useState<string>('')
	const [comformError, setComformError] = useState('')
	const [showPayConfirm, setShowPayConfirm] = useState<boolean>(false)
	const [note, setNote] = useState<string>('')
	const [messageData, setMessageData] = useState<any>()
	const [successHash, setSuccessHash] = useState('')
	const amountInputRef = useAutoFocus<HTMLInputElement>(showChatSendAmount)
	const [canSend, setCanSend] = useState(false)
	

	const { profiles, usdcbalance, beamio
	} = useDaemonContext()

	const checkBalance = () => {
		if (Number(amount) <=0) {
			setSendError('Insufficient Amount')
			return false
		}
		if (usdcbalance - Number(amount) < 0) {
			setSendError('Insufficient USDC balance')
			return false
		}

		setSendError('')
		return true
	}

	if (item) {
		displayName = `@${item.username}`
		avatarText = buildAvatarText(item)

		usernameLabel = getDisplayName(item)
		
		createdAtLabel = buildCreatedAtLabel(item.created_at)
		itemAddress = item.address
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

	const signRequest = async () => {
			
		setLoading(true)

		const paymentHeader = await AuthorizationSign(messageData.maxAmountRequired, messageData.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = messageData.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setLoading(false)
			if (!secondResponse.ok) {
				return setProcessError('RPC Error!')
			}
			setShowPayConfirm(false)
			setShowChatSendAmount(false)
			return setSuccessHash(body.USDC_tx)

		} catch (ex) {
			setLoading(false)
			return setProcessError('RPC Error!')
			
		}

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

	const Success = ({messageData}: {messageData: any}) => {

			return (
				<div className="flex-1 px-5 pt-6 pb-8 flex flex-col items-center justify-center
								bg-transparent text-inherit">

					{/* 蓝色圆圈 ✔ */}
					<div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
						✓
					</div>

					{/* 成功文字 */}
					<div className="font-semibold text-slate-600 dark:text-slate-300 mb-2 mt-4">
						{/cashcode/i.test(messageData?.sginTatle) ? 'Cashcode Created' : 'Successfully sent' } 
					</div>

					{/* 金额 */}
					<div className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
						{amount} USDC
					</div>

					{/* 提示 */}
					<div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
						{/cashcode/i.test(messageData?.sginTatle) ? 'Share this Beamio Cashcode as a link, QR, or redeem code.' : 'This may take a few seconds to appear for the receiver.' } 
					</div>

				
					

					{/* 按钮组 */}
					<div className="w-full space-y-3">

						{/* 完成按钮 */}
						<button
							className="w-full h-11 rounded-full
									bg-blue-600 text-white
									text-sm font-medium"
							onClick={() => {
								close('/')
							}}
						>
							Done
						</button>

						{/* 查看交易按钮 */}
						<button
						className="
							w-full h-11 rounded-full
							bg-black/5 text-slate-700
							dark:bg-white/10 dark:text-slate-100
							text-sm
							flex items-center justify-center gap-2
						"
						onClick={() => {
							window.open(`https://basescan.org/tx/${successHash}`, '_blank', 'noopener,noreferrer')
						}}
						>
						<img
							src={base_ex}
							alt="Base Explorer"
							className="w-4 h-4 object-contain"
						/>
						<span>
							View transaction
						</span>
						</button>
					</div>
				</div>
			)
	}

	const payClick = async() => {
		if (!checkBalance()) {
			return
		}
		setAmount(formatMoney(Number(amount)))
		setLoading(true)
		setShowPayConfirm(false)
		setComformError('')

		const sendNote = note||defaultNodeText
		const params = new URLSearchParams({amount: amount, toAddress: itemAddress, note: sendNote }).toString()
		const path = `/api/BeamioTransfer?${params}`
		const requestEndpoint = aptEndpoint + path

		try {
					
			const response = await fetch(requestEndpoint, {
				method: 'GET'
			})
			

			if (response.status !== 402) {
				setLoading(false)
				return setComformError('RPC Error!')
			}

			const { x402Version, accepts } = await response.json()
			const MessageData = accepts[0]
			MessageData.reqUrl = requestEndpoint
			MessageData.sginTatle = 'Send'
			MessageData.note = sendNote
			setMessageData(MessageData)
			setShowPayConfirm(true)
			setLoading(false)
			
		} catch (ex) {
			setLoading(false)
			setComformError('RPC Error!')
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

	const openAmount = () => {
		setShowChatSendAmount(true)

		// iOS：尽量把 focus 放在同一次点击的调用栈附近
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				amountInputRef.current?.focus({ preventScroll: true })
			})
		})
	}

	return (
		<>
			{
				(
					<>

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
							{
								!showChatSendAmount &&
								(
									<div className="flex items-center justify-between mb-4">
										<div className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/80">
											Contact
										</div>

										<button 
											className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"
											onClick={() => {
												close('')
											}}
										>
											<X className="w-4 h-4 text-white/90" strokeWidth={2} />
										</button>
									</div>
								)
							}
								

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

							{
								!showChatSendAmount && (	
									<>
									{/* @username */}
										<div className="mt-4 text-[18px] font-semibold tracking-tight">
											{usernameLabel}
										</div>

										{/* createdAtLabel */}
											{createdAtLabel && (
												<div className="mt-1 text-[11px] text-white/75">
												{displayName} since {createdAtLabel}
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
											className={`
											mt-3 inline-flex items-center gap-2
											px-4 py-1.5 rounded-full
											bg-white/20 text-[12px] font-medium text-white/95
											backdrop-blur-sm
											transition-transform duration-150 ease-out
											${copied ? "scale-95" : "hover:scale-[1.02] active:scale-95"}
											`}
											onClick={() => {
											if (!navigator?.clipboard || !item.address) return

											navigator.clipboard
												.writeText(item.address)
												.then(() => {
												setCopied(true)
												setTimeout(() => setCopied(false), 2000)
												})
												.catch(() => {
												// 失败就不切换状态，必要时可以加 toast
												})
											}}
										>
											<span className="tracking-wide">
											{shortenAddress(item.address)}
											</span>

											<span
											className={`
												w-6 h-6 rounded-full flex items-center justify-center
												transition-colors duration-150
												${copied ? "bg-emerald-500" : "bg-white/20"}
											`}
											>
											{copied ? (
												<Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
											) : (
												<Copy className="w-3.5 h-3.5 text-white/95" strokeWidth={2} />
											)}
											</span>
										</button>
										)}

										{/* Following / Followers / Follow 按钮 */}
										<div className="mt-4 grid grid-cols-3 items-center text-white/80">
										
											{/* Following */}
											<div className="flex flex-col items-center">
												<span className="text-[15px] font-semibold text-white">
												{followingCount}
												</span>
												<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
													Following
												</span>
											</div>

											{/* Followers */}
											<div className="flex flex-col items-center">
												<span className="text-[15px] font-semibold text-white">
													{followerCount}
												</span>
												<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
													Followers
												</span>
											</div>

											{/* Follow 按钮 */}
											<div className="flex justify-center">
												<AppButton
													variant={isFollowing && !removeFollowing ? "primary" : "secondary"}
													onClick={catchClick}
													loading={loading}
													className="
														px-5 py-2 rounded-full
														text-[14px] font-semibold
														shadow-md
													"
												>
												{isFollowing
													? removeFollowing
													? "Remove"
													: "Following"
													: "Follow"}
												</AppButton>
											</div>

										</div>

									</>
								)
							}
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
							
							{
								showChatSendAmount && (<>

								<div>
									<h1 className="text-[16px] font-semibold text-slate-900 mb-4 text-center">
										Pay {displayName}
									</h1>
									<div>
										{/**	金额输入 */}

										<AmountCurrency readOnly={loading || showPayConfirm} setAmount={setAmount} amount={amount} autoEntry={true} 
											showMax={!loading && !showPayConfirm} needBalance={true} showLimit={0} setError={setCanSend} />
										<div className="mb-3">
											{showPayConfirm ? (<>
												<label className="block text-[11px] font-medium text-slate-700 mb-1">
													{note? "Note" : "No note added"}
												</label>
											</>): (<>
												{/* 备注输入框 */}
													

													<input
														type="text"
														value={note}
														onChange={e => setNote(e.target.value)}
														className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
														placeholder="What's this for?"

														readOnly={loading||showPayConfirm}
													/>
											</>)}
											
										</div>

										{/* 错误 + 余额 */}
										{
											(sendError) && (
												<div className="mt-2 flex items-center justify-between text-[11px]">
													{/* 左边：错误 */}
													<div className="text-rose-500">
														{sendError}
													</div>

													{/* Right side: USDC balance */}
													<div className="text-slate-500 flex items-center gap-1">
														<span className="text-slate-400">Your balance:</span>
														<span>
															{typeof usdcbalance === "number"
															? `${usdcbalance.toLocaleString()} USDC`
															: `${usdcbalance} USDC`}
														</span>
													</div>
												</div>
											)
										}

										{
											comformError && (
												<div className="mt-2 text-center text-rose-500 text-[11px]">
													{comformError}
												</div>
											)
										}



									
									</div>

								{/* 确认支付界面 */}
								</div>
								{showPayConfirm ? (
									<>
										<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 space-y-1">
											<div className="flex items-center justify-between">
												<span>From wallet</span>
												<span className="font-medium text-slate-900">
													Beamio · USDC on Base
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span>Network fee</span>
												<span className="font-medium text-emerald-700">
													Paid by Beamio (0 gas)
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span>Beamio fee</span>
												<span className="font-medium text-slate-900">0.00 USDC</span>
											</div>
											<div className="pt-1 border-t border-dashed border-slate-200 text-[10px] text-slate-500">
												This is a direct wallet-to-wallet send on Base. Beamio sponsors the
												gas, so you only pay exactly {formatMoney(Number(amount))} USDC.
											</div>
											
										</div>
										<AppButton
											className="flex-1 h-9 rounded-full bg-sky-600 text-[13px] font-medium text-white"
											fullWidth
											loading={loading}
											onClick={() => {
												signRequest()
											}}
										>
											Send
										</AppButton>
									</>
								): (
									<>
										
											{/* 底部按钮：Cancel + Send */}
											<div className="flex gap-2 w-full mt-6">
												<AppButton 
													fullWidth
													variant="secondary"
													onClick={() => {
														setShowChatSendAmount(false)
														checkBalance()
													}}
													className="flex-1 h-9 rounded-full border border-slate-300 text-[13px] font-medium text-slate-700"
												>
													Cancel
												</AppButton>
												<AppButton
													className="flex-1 h-9 rounded-full bg-sky-600 text-[13px] font-medium text-white"
													fullWidth
													loading={loading}
													onClick={() => {
														payClick()
													}}
												>
													Send
												</AppButton>
											</div>
											

											<div className="mt-1 text-[10px] text-slate-500 text-center">
												Direct sends are gasless on Base. Beamio charges 0% fee.
											</div>
										
									</>
								)}
								
								</>
								)
							}

							

							{
								successHash && (
									<Success messageData={messageData} />
								)
							}


							{
								!showChatSendAmount && !successHash && (
									<>
									{/* 主操作按钮：Pay / Request / Chat */}
										<div className="grid grid-cols-2 gap-3 w-full">

											<AppButton
												fullWidth
												variant="primary"
												className="
													py-2.5 rounded-full
													bg-sky-600 text-white text-[13px] font-semibold shadow-sm
												"
												onClick={() => {
													close(item)
												}}
											>
												Pay
											</AppButton>

											<AppButton
												fullWidth
												variant="secondary"
												className="
												py-2.5 rounded-full
												bg-slate-50 text-slate-800 text-[13px] font-medium border border-slate-200
												"
											>
												Chat
											</AppButton>

											</div>
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
									
									</>
									
								)
							}
							
						</div>
					</div>
					
					</>
				)
			}
		
			
		
		</>		
	)
}

