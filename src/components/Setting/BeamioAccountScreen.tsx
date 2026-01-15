import React, { useState, useEffect, useRef } from 'react'
import { X, Camera, Trash2, Check } from "lucide-react";
import { useDaemonContext } from '@/providers/DaemonProvider'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { storeSystemData, postBeamio, postToIPFS } from '@/services/beamio'
import {AppButton} from '@/components/button/AppButton'
import {urlToObjectUrl} from '@/components/card/useObjectImgSrc'


const ipfsEndpoint = `https://ipfs.conet.network/api/getFragment?hash=`

const defaultName = 'Beamio'

type prof = {
	colse: (bo: beamio) => void
}

// ✅ Downscale helper：仅当 w>250 && h>250 才触发
const downscaleTo250 = (img: HTMLImageElement) => {
	const w = img.width
	const h = img.height

	// 仅当两边都超 250 才触发
	if (!(w > 250 && h > 250)) {
		return null // 表示不需要缩小
	}

	// 规则：先按高 250；若宽 < 250，则改按宽 250
	let targetH = 250
	let targetW = Math.round((w * 250) / h)

	if (targetW < 250) {
		targetW = 250
		targetH = Math.round((h * 250) / w)
	}

	const canvas = document.createElement('canvas')
	canvas.width = targetW
	canvas.height = targetH

	const ctx = canvas.getContext('2d')
	if (!ctx) return null

	ctx.clearRect(0, 0, targetW, targetH)
	ctx.drawImage(img, 0, 0, targetW, targetH)

	return canvas.toDataURL('image/png')
}



export default function BeamioAccountScreen({colse}:prof) {
	const {beamio, setBeamio, setProfiles, setDarkModle, darkModle, profiles } = useDaemonContext()
	const [avatarSeed, setAvatarSeed] = useState(beamio?.accountName||defaultName)
	const [avatarName, setAvatarName] = useState(beamio?.accountName||defaultName)
	const [firstName, setFirstName] = useState(beamio?.firstName)
	const [lastName, setLastName] = useState('')
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)
	const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)
	const [avatarFileName, setAvatarFileName] = useState<string>('')
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const [loading, setLoading] = useState(false)
	const [avatarSeedConfirmed, setAvatarSeedConfirmed] = useState(false)

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

	// ✅ 用上传图优先，否则 fallback dicebear
	const currentAvatarSrcTemp = avatarImageDataTemp || avatarUrl

	
	const initData = async (bo: beamio) => {
		if (/ipfs/i.test(bo.image)) {
			setAvatarImageDataTemp(await urlToObjectUrl(bo.image))
		}
		
		const _last = bo.lastName||''
		setLastName(_last.split('\r\n')[0])
	}

	useEffect(() => {
		
		if (!beamio) return
	
		
		initData(beamio)
			
		
		
		
	}, [])

	const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (!file.type.startsWith('image/')) {
			console.warn('Only image files are allowed')
			return
		}

		// 允许重复选择同一张图也能触发 onChange
		e.target.value = ''

		const url = URL.createObjectURL(file)
		setAvatarFileUrl(prev => {
			if (prev) URL.revokeObjectURL(prev)
			return url
		})
		setAvatarFileName(file.name)

		const reader = new FileReader()
		reader.onloadend = () => {
			const dataUrl = reader.result as string
			if (!dataUrl) return

			const img = new Image()
			img.onload = () => {
			const resized = downscaleTo250(img)
			// resized 为 null => 不需要缩小，直接用原图
			setAvatarImageDataTemp(resized || dataUrl)
			}
			img.onerror = () => setAvatarImageDataTemp(dataUrl)
			img.src = dataUrl
		}

		reader.readAsDataURL(file)
	}

	
	
	const handleSaveAvatar = async () => {
		if (!CoNET_Data|| !profiles) return
		setLoading(true)
		const tmpData = CoNET_Data
		setAvatarEditorVisible(false)
		setAvatarName(avatarSeed||defaultName)
		let hash = null
		if (avatarImageDataTemp) {
			hash = await postToIPFS(profiles[0], avatarImageDataTemp)
			if (hash) {
				hash = `${ipfsEndpoint}${hash}`
			}
		}
		const profile: profile = tmpData.profiles[0]
		const bo: beamio = {
			firstName,
			lastName,
			accountName: avatarName || defaultName,
			image: hash || currentAvatarSrcTemp,
			darkTheme: darkModle,
			isETHFaucet: beamio?.isETHFaucet|| false,
			isUSDCFaucet: beamio?.isUSDCFaucet|| false,
			initialLoading: beamio?.initialLoading||false,
			createdAt: beamio?.createdAt|| Date.now(),
			currency: 'USD',
			language: 'en'
		}

		await postBeamio(bo, profile.privateKeyArmor)

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		await storeSystemData()
		setBeamio({...bo})
		setLoading(false)
		colse(bo)
	}

	return (
		<>

		{/* Right-side sheet */}
		<aside className="">
			{/* Header */}


			{/* Content */}
			<div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
				{/* Avatar */}
				<div className="flex flex-col items-center gap-3 mb-8">
					{/* 容器负责定位 */}
					<div className="relative h-28 w-28">
						{/* 整个头像区域可点击 */}
						<button
							type="button"
							onClick={() => {
								avatarInputRef.current?.click()
							}}
							className="
								h-full w-full 
								rounded-full 
								bg-gradient-to-tr from-sky-500 to-blue-600 
								overflow-hidden shadow-md
								active:scale-95 active:shadow-lg
								transition-transform transition-shadow duration-150
								relative
								z-10
							"
						>
						{/* Avatar 图片 */}
						<img
							src={currentAvatarSrcTemp}
							alt="Avatar preview"
							className="h-full w-full object-cover"
						/>
						</button>

						{/* 右下角 iOS 半透明 x 按钮（悬浮在头像之上） */}
						{ (avatarImageDataTemp) && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation()
									setAvatarImageDataTemp(null)
									setAvatarFileUrl(null)
									setAvatarFileName('')
								}}
								className="
									absolute -bottom-1 -right-1
									h-8 w-8
									rounded-full
									bg-white/30 dark:bg-slate-900/30
									border border-white/40 dark:border-slate-700/40
									backdrop-blur-md
									shadow
									flex items-center justify-center
									text-slate-700 dark:text-slate-200
									text-sm
									active:scale-95
									transition-transform transition-colors duration-150
									z-20
								"
							>
								<span className="font-bold leading-none">×</span>
							</button>
						)}
					</div>

					<p className="text-lg text-slate-500">
						Your Beamio avatar
					</p>
						{
							!avatarImageDataTemp && (
								<>
									<div className="
										flex items-center rounded-2xl bg-slate-50 border border-slate-200
										focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100
										overflow-hidden
									">
										<span className="px-3 text-sm text-slate-500">Avatar text </span>

										<input
											value={avatarSeed}
											onChange={e => setAvatarSeed(e.target.value)}
											type="text"
											onFocus={() => setAvatarSeedConfirmed(false)}
											placeholder="any word or phrase"
											className="flex-1 bg-transparent outline-none text-sm py-3 pr-2 placeholder:text-slate-400"
										/>


										{/* ✔️ 绿色确认按钮 */}
										{
											!avatarSeedConfirmed && (
												<button
													type="button"
													onClick={() => {
														setAvatarSeedConfirmed(true)
													}}
													className="
														h-8 w-8 mr-2 flex items-center justify-center
														rounded-full bg-emerald-500 hover:bg-emerald-600
														text-white transition-all duration-150
														active:scale-90 active:ring-4 active:ring-emerald-200
													"
												>
													<Check className="w-4 h-4" strokeWidth={2} />
												</button>
											)
										}
										
									</div>
									<p className=" text-[12px] text-slate-500">
										Change the letters to pick a different avatar.
									</p>

								</>
							)
						}
						
					</div>
				<input
					ref={avatarInputRef}
					id="avatarFileInput"
					type="file"
					accept="image/*"
					capture="environment"
					className="hidden"
					onChange={handleAvatarFileChange}
				/>

				{/* Form fields */}
				<div className="space-y-5">
					{/* Beamio handle */}
					<div className="space-y-2">
						<label className="block text-sm font-medium text-slate-800">
							
							<span className="ml-1 text-xs font-normal text-slate-500">Beamio handle (@handle)</span>
						</label>
						<div className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] bg-slate-50 flex items-center justify-between">

							
							<div className="font-mono text-slate-800">
								@{avatarName}
							</div>
							<span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
								Unique &amp; permanent
							</span>
							</div>
						
						<p className="text-xs text-slate-500">
							Set once during onboarding. This is the public name friends and
							merchants see when they pay you, and it is used together with your
							PIN to help restore this wallet.
						</p>
					</div>

					{/* First name */}
					<div className="space-y-2">
					<label className="block text-sm font-medium text-slate-800">First name</label>
					<input
						value={firstName}
						onChange={e => {
							setFirstName(e.target.value)
						}}
						type="text"
						placeholder="First name"
						className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
					/>
					</div>

					{/* Last name */}
					<div className="space-y-2">
						<label className="block text-sm font-medium text-slate-800">Last name</label>
						<input
							value={lastName}
							onChange={e => {
								setLastName(e.target.value)
							}}
							type="text"
							placeholder="Last name"
							className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
						/>
					</div>
				</div>
				<p className="mt-3 text-[10px] text-slate-500 leading-snug">
					Optional. Used on receipts and statements, not required for wallet recovery.
				</p>
				<p className="mt-3 text-[10px] text-slate-500 leading-snug">
					Beamio does not keep a centralized user database. Your account
					information is stored on your device and/or on-chain.
				</p>

				

				
			</div>

			{/* Footer actions */}
			
			
			<div className="mt-auto px-4 pb-6">
				<AppButton
					onClick={handleSaveAvatar}
					loading={loading}
					fullWidth
				>
					Save
				</AppButton>
			</div>
			
			<div className="h-20" />
			
		</aside>
		</>
	)
}
