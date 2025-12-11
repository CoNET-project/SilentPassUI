import Card from './Card'
import { AppButton } from '../button/AppButton'
import {IMenu} from './setup'
import ScreenShell from './ScreenShell'
import { useDaemonContext } from '@/providers/DaemonProvider'
import React, { useState, useEffect } from 'react'
import {RecoveryInputs} from './RecoveryCodeInput'
import { getUserInfo, storeSystemData, RegenerateRecover } from "@/services/beamio"
import RecoveryQRScreen from '@/pages/Home/RecoveryQRScreen'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
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
	const [pin, setPin] = useState('')
	const [error, setError] = useState('')
	const [storeTemp, setStoreTemp] = useState()
	

	const handleSubmit = async () => {
		setError('')
		if (!beamio||!CoNET_Data||!profiles) {
			setError('beamio APP unknow error, try again late!')
			return
		}
		
		
		if (pin.trim().length < 6 || pin.trim().length > 8 || !/^[0-9]+$/.test(pin.trim())) {
			setError('PIN must be 6–8 digits')
			return
		}

		const mnemonicPhrase = CoNET_Data.mnemonicPhrase
		const profile: profile = profiles[0]
		setLoading(true)
		
		const kk = await RegenerateRecover(mnemonicPhrase, beamio,pin, profile.privateKeyArmor)

		setLoading(false)

		if (!kk) {
			setError('RegenerateRecover had RPC error, try again late!')
			return
		}

		setNewRecoverUrl (kk.qrCode)
		setNewCode(kk.qrCode)
		setNewRecoveryCode(true)
		CoNET_Data.encryptedString = kk.qrCode
		setCoNET_Data(CoNET_Data)
		await storeSystemData()
	}


	return (
		 <ScreenShell
			title="Recovery & backup"
			subtitle="Beamio does not store your Recovery QR or PIN. You can only test the ones you saved. If lost, you must regenerate new ones."
			>
			{/* Summary banner */}
			<div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 mb-1">
				<div className="text-[12px] font-semibold text-sky-900 mb-0.5">Non-custodial wallet</div>
				<p className="text-[11px] text-sky-800 leading-snug">
					Your Recovery QR and PIN were generated during onboarding. Beamio never saved them.
					You can test whether your copies still work, or regenerate new ones if you lost them.
				</p>
			</div>

			{/* Recovery QR card */}

			{
				newRecoveryCode ? (
					<RecoveryQRScreen qrDataUrl={newRecoverUrl} recoveryCode={newCode} close={() => {
						colse('')
					}} />
				) : (
					<>
						<Card
							title="Recovery Tester"
							description="You can test your saved Recovery. Beamio does not store it."
						>
							<div className="flex flex-col gap-2 mt-1">


								<RecoveryInputs pin={(_pin => {
									if (!CoNET_Data || !CoNET_Data.encryptedString) {
										return
									}
									setNewRecoverUrl(CoNET_Data.encryptedString)
									setNewCode(CoNET_Data.encryptedString)
									setNewRecoveryCode(true)
								})} />
						
							
							</div>
						</Card>
						{/* PIN card */}
						
						<p className="mt-3 text-[10px] text-slate-500 leading-snug">
							If you cannot test your QR or PIN because you forgot them, regenerate a new Recovery QR and PIN.
							Your wallet address and funds stay the same.
						</p>

						<Card
							title="Regenerate Recovery QR"
							description="We’ll create a new Recovery QR using your current PIN. Your PIN stays the same."
						>
							<div className="flex flex-col gap-2 mt-1">

								{/* Warning */}
									<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-3">
										<div className="text-[12px] font-semibold text-amber-900 mb-0.5">Before you continue</div>
										<p className="text-[11px] text-amber-800 leading-snug">
											The old Recovery QR and PIN will no longer work. Only the new pair you save will be valid.
											Beamio will not keep a copy, so make sure you store them securely.
										</p>
									</div>

									{/* Inputs */}
										<div className="mt-1">
											<div className="flex items-center">
												<label className="text-[11px] font-medium text-slate-600 w-24 ">
													new PIN
												</label>

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

											<p className="mt-2 text-[10px] text-slate-500 leading-snug">
												If you no longer remember your PIN, you can still regenerate — but the old encrypted backup cannot be decrypted.
												Your wallet address and funds remain the same.
											</p>

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
										</div>
								{
									!showRegenerateConfirm && (
										<>
											

												<div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
												<div className="text-[12px] font-semibold text-slate-800 mb-1">
													What stays the same?
												</div>
												<ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
													<li>Your wallet address and funds do not change.</li>
													<li>You will receive a new Recovery QR and PIN pair.</li>
													<li>Beamio never stores your old or new recovery data.</li>
												</ul>
												</div>

												<AppButton
													fullWidth
													className="mt-3"
													onClick={() => {
														setError('')
														if (pin.trim().length < 6 || pin.trim().length > 8 || !/^[0-9]+$/.test(pin.trim())) {
															setError('PIN must be 6–8 digits')
															return
														}
														setShowRegenerateConfirm(true)
													}}
												>
													Regenerate
												</AppButton>
										</>
									)
								}
								

									<>
										

							
									{showRegenerateConfirm && (
										<>
											{/* 警告文案 */}
											<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
												<div className="text-[11px] font-semibold text-amber-800 mb-0.5">
													Warning
												</div>
												<p className="text-[11px] text-amber-800 leading-snug">
													If you continue, your previous Recovery QR and PIN will no longer be
													able to restore your wallet. Your future recovery will use the newly
													generated Recovery QR and PIN.
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

																setShowRegenerateConfirm(false)
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
							</>
							
							</div>
						</Card>
					</>
				)
			}

			

			

			
			</ScreenShell>
	)
}
  
   


export default RecoveryBackupScreen