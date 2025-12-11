import { FormEvent, useState, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import {
	restoreWithUserPin
} from '@/services/beamio'

type RestoreWithUsernamePinScreenProps = {
  	onRestore: (temp: encrypt_keys_object) => Promise<void> | void
}

const RestoreWithUsernamePinScreen = ({
  	onRestore,
}: RestoreWithUsernamePinScreenProps) => {
	const [username, setUsername] = useState('')
	const [pin, setPin] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!error) {
			return
		}
		setTimeout(() => {
			setError('')
		}, 4000)
	},[error])
	

	const formatBeamioName = () => {
		setError('')
		// 简单本地校验
		const trimmed = username.trim()
		if (!trimmed) {
			setError('Please enter a username')
			return ''
		}

		if (!/^[a-zA-Z0-9_\.]{3,20}$/.test(trimmed)) {
			setError('Use 3–20 letters, numbers or dots')
			return ''
		}
		return trimmed
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()

		const trimmed = formatBeamioName ()
		if (!trimmed) {
			return
		}


		if (pin.trim().length < 6 || pin.trim().length > 8 || !/^[0-9]+$/.test(pin.trim())) {
			setError('PIN must be 6–8 digits')
			return
		}

		
		setLoading(true)
		const canRestore = await restoreWithUserPin( trimmed, pin.trim())
		setLoading(false)

		if (!canRestore||typeof canRestore === 'boolean') {
			setError('Something went wrong while restoring your wallet.')
			return 
		}

		onRestore(canRestore)

	}

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col gap-4 text-[13px] text-slate-900 flex-1 px-6 pt-8 pb-10"
		>
			{/* 小标题 */}
			<div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
				Restore · Method 2
			</div>

			{/* 标题 */}
			<h1 className="text-[26px] font-semibold text-slate-900">
				Restore via CoNET backup
			</h1>

			{/* 说明文字 */}
			<p className="mt-1 text-[14px] text-slate-500 leading-snug">
				We&apos;ll fetch your encrypted backup using your @username, then decrypt
				it locally with your PIN.
			</p>

			{/* Username 输入 */}
			<div className="flex flex-col gap-1.5 mt-2">
				<label className="text-[12px] font-medium text-slate-700">
				@username
				</label>
				<input
				type="text"
				className="
					w-full rounded-[18px] border border-slate-200 bg-white
					px-3 py-2.5 text-[13px] text-slate-900
					placeholder:text-slate-400 outline-none
					focus:border-sky-400 focus:ring-2 focus:ring-sky-100
				"
				placeholder="Your Beamio username"
				value={username}
				onChange={e => setUsername(e.target.value)}
				/>
			</div>

			{/* PIN 输入 */}
			<div className="flex flex-col gap-1.5 mt-2">
				<label className="text-[12px] font-medium text-slate-700">PIN</label>
				<input
				inputMode="numeric"
				className="
					w-full rounded-[18px] border border-slate-200 bg-white
					px-3 py-2.5 text-[13px] text-slate-900
					placeholder:text-slate-400 outline-none
					focus:border-sky-400 focus:ring-2 focus:ring-sky-100
				"
				placeholder="6–8 digit PIN"
				value={pin}
				onChange={e => setPin(e.target.value)}
				/>
			</div>

			{/* 说明卡片 */}
			<div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
				<div className="text-[12px] font-semibold text-amber-900 mb-1">
					How this works
				</div>
				<p className="text-[11px] leading-snug text-amber-900/90">
					We read an encrypted blob bound to your @username from CoNET. Your
					PIN, processed with scrypt, is used locally to unlock it. We never see
					your private key.
				</p>
			</div>

			{/* 错误信息 */}
			{error && (
				<div
				className="
					mt-4 mb-2 px-3 py-2
					rounded-[12px]
					text-[12px]
					text-red-700
					bg-red-50
					border border-red-200
				"
				>
				{error}
				</div>
			)}

			{/* 底部按钮 */}
			<div className="mt-4">
				<AppButton
					type="submit"
					fullWidth
					disabled={loading}
					className="rounded-[999px] py-3 text-[15px] font-semibold"
				>
				{loading ? 'Restoring…' : 'Restore wallet'}
				</AppButton>
			</div>
		</form>
	)
}
export default RestoreWithUsernamePinScreen