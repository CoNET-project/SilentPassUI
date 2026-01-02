import { AppButton } from '@/components/button/AppButton'
import React, { useState,useEffect } from 'react'
import {
	checkBeamioAccountAPI,
	createRecover,
	storeSystemData
} from '@/services/beamio'


const CreateUsernamePinScreen = ({close}: {close: (val: {qrDataUrl: string, pin: string, passcode: string, temp: encrypt_keys_object}) => void}) => {
	const [beamioName, setBeamioName] = useState('')
	const [beamioNameError, setBeamioNameError] = useState('')

	const [pin, setPin] = useState('')
	const [pinConfirm, setPinConfirm] = useState('')
	const [pinError, setPinError] = useState('')
	const [loading, setLoading] = useState(false)

	const formatBeamioName = () => {
		setBeamioNameError('')
		// 简单本地校验
		const trimmed = beamioName.trim()
		if (!trimmed) {
			setBeamioNameError('Please enter a username')
			return ''
		}

		if (!/^[a-zA-Z0-9_\.]{3,20}$/.test(trimmed)) {
			setBeamioNameError('Use 3–20 letters, numbers or dots')
			return ''
		}
		return trimmed
	}


	const handleContinue = async () => {
		const trimmed = formatBeamioName()
		if (!trimmed) {
			return
		}

		setPinError("")

		const password = (pin || "").trim()
		const confirm = (pinConfirm || "").trim()

		// ✅ Password: 6+ 任意字符（字母/数字/符号都可）
		if (password.length < 6) {
			setPinError("Password must be at least 6 characters")
			return
		}

		if (password !== confirm) {
			setPinError("Passwords do not match")
			return
		}

		setLoading(true)

		const isGood = await checkBeamioAccountAPI(trimmed)

		if (!isGood) {
			setLoading(false)
			setBeamioNameError(`This @${trimmed} is already taken`)
			return
		}

		// ✅ 继续沿用原参数名 pin，但传入 password（避免影响现有 createRecover 签名）
		const kks = await createRecover(trimmed, password)
		setLoading(false)

		if (!kks) {
			return setBeamioNameError("Error, try again!")
		}

		close({
			qrDataUrl: kks.qrCode,
			pin: password,          // 若后续你会重命名为 password，这里再一起改
			passcode: kks.recoverCode,
			temp: kks.temp,
		})
	}

	return (
			<div className="px-6 pt-8 pb-10">
				{/* 顶部步骤标题 */}
				<div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">
					Account · Step 1 of 2
				</div>

				{/* 主标题 */}
				<h1 className="text-[26px] font-semibold text-slate-900">
					Create your Beamio account
				</h1>

				{/* 副标题 */}
				<p className="mt-1 text-[14px] text-slate-500 leading-snug">
					Pick a unique @BeamioTag for payments and a PIN to protect your wallet
					backup.
				</p>

				<div className="mt-6 space-y-5">
					{/* username */}
					<div>
						<div className="text-xs font-semibold text-slate-600 mb-1.5">
							<span className="font-mono">@</span>
							<span className="ml-1">BeamioTag</span>
						</div>
						<input
							
							readOnly={loading}
							className="
								w-full h-11 px-4 rounded-2xl
								border border-slate-200 bg-slate-50/40
								text-[15px] text-slate-900
								placeholder:text-slate-400
								outline-none
								focus:border-sky-400 focus:ring-1 focus:ring-sky-300
							"
							value={beamioName}
							placeholder="myshop, myname ..."
							onChange={e => {
								setBeamioName(e.currentTarget.value)
								setBeamioNameError('')
							}}
						/>
						{beamioNameError && (
							<p className="mt-1 text-[11px] text-rose-500">{beamioNameError}</p>
						)}
						<p className="mt-2 text-[11px] text-slate-500 leading-snug">
							Friends and customers can pay you by typing{' '}
							<span className="font-mono">@BeamioTag</span>, no wallet address
							needed. This handle cannot be changed later.
						</p>
					</div>

					{/* PIN */}
					<div>
						<div className="text-xs font-semibold text-slate-600 mb-1.5">Password</div>
						<input
							readOnly={loading}
							type="password"
							autoComplete="new-password"
							minLength={6}
							spellCheck={false}
							autoCapitalize="none"
							autoCorrect="off"
							className="
								w-full h-11 px-4 rounded-2xl
								border border-slate-200 bg-slate-50/40
								text-[15px] text-slate-900
								placeholder:text-slate-400
								outline-none
								focus:border-sky-400 focus:ring-1 focus:ring-sky-300
							"
							value={pin}
							placeholder="At least 6 characters"
							onChange={e => {
								setPin(e.currentTarget.value)
								setPinError("")
							}}
						/>
					</div>

					{/* Confirm PIN */}
					<div>
						<div className="text-xs font-semibold text-slate-600 mb-1.5">
							Confirm Password
						</div>
						<input
							readOnly={loading}
							type="password"
							autoComplete="new-password"
							minLength={6}
							spellCheck={false}
							autoCapitalize="none"
							autoCorrect="off"
							className="
								w-full h-11 px-4 rounded-2xl
								border border-slate-200 bg-slate-50/40
								text-[15px] text-slate-900
								placeholder:text-slate-400
								outline-none
								focus:border-sky-400 focus:ring-1 focus:ring-sky-300
							"
							value={pinConfirm}
							placeholder="Re-enter password"
							onChange={e => {
								setPinConfirm(e.currentTarget.value)
								setPinError("")
							}}
						/>
						{pinError && (
							<p className="mt-1 text-[11px] text-rose-500">{pinError}</p>
						)}
					</div>

					{/* PIN tips card */}
					<div className="mt-1 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
						<div className="text-xs font-semibold text-amber-800 mb-1">
							Password tips
						</div>
						<p className="text-[11px] leading-snug text-amber-900">
							Use at least 6 characters that you can remember but others can’t guess.
							Letters, numbers, and symbols are all supported. We use scrypt locally to
							protect your password against offline attacks. Beamio never sends your
							password to any server.
						</p>
					</div>
				</div>

				{/* Continue button */}
				<div className="mt-6">
					<AppButton
					fullWidth
					loading={loading}
					onClick={handleContinue}
					className="rounded-[999px] py-3 text-[15px] font-semibold"
					>
						Continue
					</AppButton>
				</div>
			</div>
		)
		}

export default CreateUsernamePinScreen
