import Card from './Card'
import { AppButton } from '../button/AppButton'
import {IMenu} from './setup'
import ScreenShell from './ScreenShell'
import { useDaemonContext } from '@/providers/DaemonProvider'
import React, { useState, useEffect, useRef } from 'react'
import {RecoveryInputs} from './RecoveryCodeInput'
import { getUserInfo, storeSystemData, RegenerateRecover } from "@/services/beamio"
import RecoveryQRScreen from '@/pages/Home/RecoveryQRScreen'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { Eye } from "lucide-react"

type prof = {
	colse: (val: IMenu) => void
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

const RecoveryBackupScreen: React.FC<prof> = ({colse}) => {
	const { beamio, profiles } = useDaemonContext()
	const [recoveryCode, setRecoveryCode] = useState('')
	const [newRecoveryCode, setNewRecoveryCode]= useState(false)
	const [loading, setLoading]= useState(false)
	const [newRecoverUrl, setNewRecoverUrl] = useState('')
	const [newCode, setNewCode] = useState('')
	const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
	const [password, setpassword] = useState('')
	const [error, setError] = useState('')
	const [storeTemp, setStoreTemp] = useState()
	const [peekPinConfirm, setPeekPinConfirm] = useState(false)
	const eyeBtnRef = useRef<HTMLButtonElement | null>(null)
	const [peekPin, setPeekPin] = useState(false)
	const [pin, setPin] = useState('')
	const [pinError, setPinError] = useState('')
	const [pinConfirm, setPinConfirm] = useState('')
	

	const handleSubmit = async () => {
		setError('')
		if (!beamio||!CoNET_Data||!profiles) {
			setError('Beamio app unknown error. Please try again later.')
			return
		}
		
		
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

		if (!showRegenerateConfirm) {
			return setShowRegenerateConfirm(true)
		}

		const mnemonicPhrase = CoNET_Data.mnemonicPhrase
		const profile: profile = profiles[0]
		setLoading(true)
		
		const kk = await RegenerateRecover(mnemonicPhrase, beamio, password, profile.privateKeyArmor)

		setLoading(false)

		if (!kk) {
			setError('Regenerate recovery failed due to RPC error. Please try again later.')
			return
		}

		setNewRecoverUrl (kk.qrCode)
		setNewCode(kk.qrCode)
		setNewRecoveryCode(true)
		CoNET_Data.encryptedString = kk.qrCode
		setCoNET_Data(CoNET_Data)
		await storeSystemData()
	}


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


	return (
		 <ScreenShell
			title="Backup & export"
			subtitle="
				Rotate recovery or export your private key.
			"
			>
			

			{/* Recovery QR card */}

				{
				newRecoveryCode ? (
					<RecoveryQRScreen qrDataUrl={newRecoverUrl} recoveryCode={newCode}
					beamioTag={beamio?.accountName}
					showButton={true}
					close={() => {
						colse('')
					}} />
				) : (
					<>
						{/* <Card
							title="View your saved Recovery"
							description="Enter your password (at least 6 characters) to decrypt the Recovery QR and recovery code (S) stored on this device. Beamio never sees or stores your password."
						>
							<div className="flex flex-col gap-2 mt-1">


								<RecoveryInputs pin={(_password => {
									if (!CoNET_Data || !CoNET_Data.encryptedString) {
										return
									}
									setNewRecoverUrl(CoNET_Data.encryptedString)
									setNewCode(CoNET_Data.encryptedString)
									setNewRecoveryCode(true)
								})} />
						
							
							</div>
							<p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
								If you can&apos;t view your Recovery because you forgot your password,
								use &quot;Change password &amp; regenerate Recovery&quot; below. Your
								wallet address and funds stay the same.
							</p>
						</Card> */}

						<Card
							title="Create a new Recovery QR"
							description={showRegenerateConfirm ? "This will replace your current Recovery QR and recovery code." 
								: "Generate a new Recovery QR + recovery code. Use this if you think your old recovery might be exposed."}
						>
							{/* <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
								<p className="text-xs font-semibold text-amber-900">
								Before you continue
								</p>
								<p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
								Your old Recovery QR and password will no longer work. Only the new
								pair you save will be valid. Beamio will not keep a copy, so make
								sure you store them securely.
								</p>
							</div> */}

						

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
							

							{/* <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
								If you no longer remember your old password, you can still generate a new
								Recovery QR and password — but the old encrypted backup cannot be
								decrypted. Your wallet address and funds remain the same.
							</p> */}

							

							{
							!showRegenerateConfirm && (
								<>
	{/* PIN */}
						<div>
						
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
								{/* <div className="text-xs font-semibold text-slate-600 mb-1.5">
									Confirm Password
								</div> */}
								<div className="relative mt-4">
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
								<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
									<p className="text-xs font-semibold text-amber-900">
										What stays the same
									</p>
									<p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
										Your wallet address and on‑chain funds do not change. This only replaces your restore credentials.
									</p>
								</div>
									{/* “What stays the same?” 列表 */}
									{/* <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3">
										<p className="text-xs font-semibold text-slate-800">
										What stays the same?
										</p>
										<ul className="mt-1 space-y-1.5 text-[11px] text-slate-600">
										<li>• Your wallet address and on-chain funds do not change.</li>
										<li>• You receive a new Recovery QR + password pair.</li>
										<li>• Beamio never stores your old or new recovery data.</li>
										</ul>
									</div> */}

									<AppButton
										fullWidth
										className="mt-3"
										onClick={() => {
											setError('')
											handleSubmit()
										}}
									>
										Regenerate
									</AppButton>
								</>
							)
						}

						{showRegenerateConfirm && (
							<>
								{/* 警告文案 */}
								<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
									<div className="text-[11px] font-semibold text-amber-800 mb-0.5">
										Before you continue
									</div>
									<p className="text-[11px] text-amber-800 leading-snug">
										Save the new Recovery QR before you leave the next screen. Beamio does not store a copy.
									</p>
								</div>

								{/* 二个按钮：Cancel / Continue */}
								<div className="mt-3 flex gap-3 w-full">
									{
										!loading && <AppButton
												fullWidth
												variant="secondary"
												className="flex-1"
												onClick={() => {

													handleSubmit()
												}}
											>
												Cancel
											</AppButton>
									}
									

									<AppButton
										fullWidth
										className="flex-1"
										loading={loading}
										onClick={() => {
											handleSubmit()
										}}
									>
										Continue
									</AppButton>
								</div>

								
							</>
						)}
							
						</Card>
						
						
					</>
				)
			}
			
			</ScreenShell>
	)
}
  
   


export default RecoveryBackupScreen