import { AppButton } from '@/components/button/AppButton'
import React, { useState, useEffect, useRef } from 'react'
import {
	checkBeamioAccountAPI,
	createRecover,
	storeSystemData
} from '@/services/beamio'

import { Eye } from "lucide-react"


const CreateUsernamePinScreen = ({close}: {close: (val: {qrDataUrl: string, pin: string, passcode: string, temp: encrypt_keys_object}) => void}) => {
	const [beamioName, setBeamioName] = useState('')
	const [beamioNameError, setBeamioNameError] = useState('')

	const [pin, setPin] = useState('')
	const [pinConfirm, setPinConfirm] = useState('')
	const [pinError, setPinError] = useState('')
	const [loading, setLoading] = useState(false)

	const lastCheckedRef = useRef<string>("")

	const [peekPinConfirm, setPeekPinConfirm] = useState(false)
	const eyeBtnRef = useRef<HTMLButtonElement | null>(null)
	const [peekPin, setPeekPin] = useState(false)

	function startPeek(e: React.PointerEvent<HTMLButtonElement>) {
		// 避免按钮抢走输入焦点/触发键盘闪动
		e.preventDefault()
		e.stopPropagation()

		setPeekPinConfirm(true)

		// 捕获指针：即使手指移出按钮，松开也能收到 pointerup
		try {
			e.currentTarget.setPointerCapture(e.pointerId)
		} catch {}
	}

	function endPeek(e?: React.PointerEvent<HTMLButtonElement>) {
		setPeekPinConfirm(false)

		// 释放捕获（可选）
		if (e) {
			try {
			e.currentTarget.releasePointerCapture(e.pointerId)
			} catch {}
		}
	}


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

	useEffect (() => {
		if (!beamioNameError) return
		setTimeout (() => {
			setBeamioNameError('')
		}, 3000)
	}, [beamioNameError])

	const checkBeamioTag = async () => {
		
		const trimmed = formatBeamioName()
		const isGood = await checkBeamioAccountAPI(trimmed)
		
		if (!isGood) {
			
			setBeamioNameError(`This @${trimmed} is already taken`)
			return false
		}
		
		return true
	}


	const handleContinue = async () => {
		
		

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

		if (!checkBeamioTag()) {
			return
		}

		setLoading(true)
		const trimmed = formatBeamioName()

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
					WALLET · STEP 1 OF 2
				</div>

				{/* 主标题 */}
				<h1 className="text-[26px] font-semibold text-slate-900">
					Create your wallet
				</h1>

				{/* 副标题 */}
				<p className="mt-1 text-[14px] text-slate-500 leading-snug">
					Choose an @BeamioTag and set a password.
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
								setBeamioNameError("")
							}}

							onBlur={async () => {
								const v = (beamioName ?? "").trim()

								// 空值：你可以选择不查，只给错误提示（按你业务需要）
								if (!v) {
									setBeamioNameError("Beamio Tag is required")
									return
								}

								// 防止重复调用：值没变就不查
								if (v === lastCheckedRef.current) return
								lastCheckedRef.current = v

								try {
									await checkBeamioTag()
								} catch (err) {
									
									
								}
							}}
						/>

						{beamioNameError && (
							<p className="mt-1 text-[11px] text-rose-500">{beamioNameError}</p>
						)}

						<p className="mt-2 text-[11px] text-slate-500 leading-snug">
							People can pay you using your tag. You can’t change it later.
						</p>
					</div>

					{/* PIN */}
					<div>
						<div className="text-xs font-semibold text-slate-600 mb-1.5">Password</div>
						{/* Password input */}
							<div className="relative">
							<input
								readOnly={loading}
								type={peekPin ? "text" : "password"}
								autoComplete="new-password"
								minLength={6}
								spellCheck={false}
								autoCapitalize="none"
								autoCorrect="off"
								className="
								w-full h-11 px-4 pr-11 rounded-2xl
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

							{/* 👁 press-to-peek */}
							<button
								type="button"
								tabIndex={-1}
								aria-label="Press and hold to peek password"
								className="
								absolute
								right-3
								top-1/2
								-translate-y-1/2
								h-8 w-8
								rounded-full
								flex items-center justify-center
								text-slate-400 hover:text-slate-600
								active:bg-slate-200/50
								transition
								touch-manipulation
								select-none
								"
								onPointerDown={e => {
								e.preventDefault()
								e.stopPropagation()
								setPeekPin(true)
								try {
									e.currentTarget.setPointerCapture(e.pointerId)
								} catch {}
								}}
								onPointerUp={e => {
								setPeekPin(false)
								try {
									e.currentTarget.releasePointerCapture(e.pointerId)
								} catch {}
								}}
								onPointerCancel={() => setPeekPin(false)}
								onPointerLeave={() => setPeekPin(false)}
							>
								<Eye className="w-5 h-5" />
							</button>
							</div>

							{/* helper text */}
							<p className="mt-2 text-[13px] text-slate-500">
							Use 6+ characters. Beamio doesn’t store your password.
							</p>
					</div>

					{/* Confirm PIN */}
					<div>
						<div className="text-xs font-semibold text-slate-600 mb-1.5">
							Confirm Password
						</div>
						<div className="relative">
							<input
								readOnly={loading}
								type={peekPinConfirm ? "text" : "password"}
								autoComplete="new-password"
								minLength={6}
								spellCheck={false}
								autoCapitalize="none"
								autoCorrect="off"
								className="
								w-full h-11 px-4 pr-11 rounded-2xl
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

							{/* 👁 press-to-peek */}
							<button
								ref={eyeBtnRef}
								type="button"
								tabIndex={-1}
								aria-label="Press and hold to peek password"
								className="
								absolute right-3 top-1/2 -translate-y-1/2
								h-8 w-8 rounded-full
								flex items-center justify-center
								text-slate-400 hover:text-slate-600
								active:bg-slate-200/50
								transition
								touch-manipulation
								select-none
								"
								onPointerDown={startPeek}
								onPointerUp={endPeek}
								onPointerCancel={endPeek}
								onPointerLeave={() => setPeekPinConfirm(false)}
								// 保险：某些环境下 pointer 事件缺失时，mouse/touch 兜底（可留可不留）
								onMouseDown={e => {
								e.preventDefault()
								setPeekPinConfirm(true)
								}}
								onMouseUp={() => setPeekPinConfirm(false)}
							>
								<Eye className="w-5 h-5" />
							</button>
							</div>
						{pinError && (
							<p className="mt-1 text-[11px] text-rose-500">{pinError}</p>
						)}
					</div>

					{/* PIN tips card */}
					<div className="mt-1 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
						<div className="text-xs font-semibold text-amber-800 mb-1">
							How Beamio restores wallets
						</div>
						<p className="text-[11px] leading-snug text-amber-900">
							Beamio stores only an encrypted backup record on-chain. Your password decrypts it locally on your device.
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
