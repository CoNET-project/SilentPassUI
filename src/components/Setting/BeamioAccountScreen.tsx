import React, { useState, useEffect, useRef } from 'react'
import { X, Camera, Trash2 } from "lucide-react";
import { useDaemonContext } from '@/providers/DaemonProvider'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { storeSystemData } from '@/services/beamio'
import {AppButton} from '@/components/button/AppButton'
const defaultName = 'Beamio'

type prof = {
	colse: () => void
}

export default function BeamioAccountScreen({colse}:prof) {
	const {  beamio, setBeamio, setProfiles, setDarkModle, darkModle } = useDaemonContext()
	const [avatarSeed, setAvatarSeed] = useState(beamio?.accountName||defaultName)
	const [avatarName, setAvatarName] = useState(beamio?.accountName||defaultName)
	const [firstName, setFirstName] = useState(beamio?.firstName)
	const [lastName, setLastName] = useState(beamio?.lastName)
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)
	const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)
	const [avatarFileName, setAvatarFileName] = useState<string>('')
	const avatarInputRef = useRef<HTMLInputElement>(null)

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

	const currentAvatarSrcTemp = avatarImageDataTemp || avatarFileUrl || avatarUrl

	useEffect(() => {
		
		if (!beamio) return
	
		if (beamio.image && !/^http/.test(beamio.image)) {
			setAvatarImageDataTemp(beamio.image)
		}
	}, [])
	
	const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const url = URL.createObjectURL(file)
		setAvatarFileUrl(prev => {
			if (prev) URL.revokeObjectURL(prev)
			return url
		})
		setAvatarFileName(file.name)

		const reader = new FileReader()
		reader.onloadend = () => {
			const dataUrl = reader.result as string
			setAvatarImageDataTemp(dataUrl)
		}
		reader.readAsDataURL(file)
	}

	const handleSaveAvatar = () => {
		if (!CoNET_Data) return
		const tmpData = CoNET_Data
		setAvatarEditorVisible(false)
		setAvatarName(avatarSeed||defaultName)
		
		const bo: beamio = {
			firstName,
			lastName,
			accountName: avatarName || defaultName,
			image: currentAvatarSrcTemp,
			darkTheme: darkModle,
			isETHFaucet: beamio?.isETHFaucet|| false,
			isUSDCFaucet: beamio?.isUSDCFaucet|| false,
			initialLoading: beamio?.initialLoading||false
		}

		tmpData.beamio = bo
		setCoNET_Data(tmpData)
		
		storeSystemData()
		setBeamio(bo)
		colse()
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

					<p className="text-xs text-slate-500">
						Your Beamio avatar (stored locally / on-chain, not in our servers)
					</p>
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
							Beamio name
							<span className="ml-1 text-xs font-normal text-slate-500">(@handle)</span>
						</label>
						<div className="flex items-center rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 overflow-hidden">
							<span className="px-3 text-sm text-slate-500">@</span>
							<input
								value={avatarSeed}
								onChange={e => {
									setAvatarName(e.target.value)
									setAvatarSeed(e.target.value)
								}}
								type="text"
								placeholder="yourname"
								className="flex-1 bg-transparent outline-none text-sm py-3 pr-4 placeholder:text-slate-400"
							/>
						</div>
					<p className="text-xs text-slate-500">
						This is the public name friends and merchants see when they pay you.
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
			</div>

			{/* Footer actions */}
			<footer className="mt-auto px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 bg-white/90 backdrop-blur">
			
			<AppButton
				onClick={handleSaveAvatar}
				
				fullWidth
			>
				Save
			</AppButton>
			
			</footer>
		</aside>
		</>
	)
}
