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
			title="Recovery & Backup"
			subtitle="Beamio doesn't store your Recovery QR or PIN. You can view the ones you saved, or create a new Recovery QR + PIN pair if you want to change your PIN."
			>
			

			{/* Recovery QR card */}

			{
				newRecoveryCode ? (
					<RecoveryQRScreen qrDataUrl={newRecoverUrl} recoveryCode={newCode} close={() => {
						colse('')
					}} />
				) : (
					<>
						<Card
							title="View your saved Recovery"
							description="Enter your 6–8 digit PIN to decrypt the Recovery QR and recovery code (S) stored on this device. Beamio never sees or stores your PIN."
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
							<p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
								If you can&apos;t view your Recovery because you forgot your PIN,
								use &quot;Change PIN &amp; regenerate Recovery&quot; below. Your
								wallet address and funds stay the same.
							</p>
						</Card>

						<Card
							title="Change PIN & regenerate Recovery"
							description="Enter your 6–8 digit PIN to decrypt the Recovery QR and recovery code (S) stored on this device. Beamio never sees or stores your PIN."
						>
							<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
								<p className="text-xs font-semibold text-amber-900">
								Before you continue
								</p>
								<p className="mt-1 text-[11px] text-amber-900 leading-relaxed">
								Your old Recovery QR and PIN will no longer work. Only the new
								pair you save will be valid. Beamio will not keep a copy, so make
								sure you store them securely.
								</p>
							</div>

							<div className="flex items-center mt-4">
								<label className="text-[11px] font-medium text-slate-600 w-24 ">
									New PIN
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
							

							<p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
								If you no longer remember your old PIN, you can still generate a new
								Recovery QR and PIN — but the old encrypted backup cannot be
								decrypted. Your wallet address and funds remain the same.
							</p>

							{
							!showRegenerateConfirm && (
								<>
									{/* “What stays the same?” 列表 */}
									<div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3">
										<p className="text-xs font-semibold text-slate-800">
										What stays the same?
										</p>
										<ul className="mt-1 space-y-1.5 text-[11px] text-slate-600">
										<li>• Your wallet address and on-chain funds do not change.</li>
										<li>• You receive a new Recovery QR + PIN pair.</li>
										<li>• Beamio never stores your old or new recovery data.</li>
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
							
						</Card>
						
						
					</>
				)
			}

			

			

			
			</ScreenShell>
	)
}
  
   


export default RecoveryBackupScreen