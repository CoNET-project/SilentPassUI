import { useState, FormEvent, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import ScanBtn from '@/components/scanBtn/ScanButton'
import { onWalletEvent, restoreWithRedeem} from '@/services/beamio'


type RestoreWithQRScreenProps = {
	onRestore: (temp: encrypt_keys_object) => void
}



const RestoreWithQRScreen = ({
		onRestore
	}: RestoreWithQRScreenProps) => {
		const [recoveryCode, setRecoveryCode] = useState('')
		const [pin, setPin] = useState('')
		const [loading, setLoading] = useState(false)
		const [error, setError] = useState('')
		const checkRecover = async (code: string, _pin: string) => {
		return true
	}

	useEffect(() => {
		if (!error) {
			return
		}
		setTimeout(() => {
			setError('')
		}, 4000)
	},[error])

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		// 清空旧错误
  		setError('')
		if (!recoveryCode.trim()) {
			setError('Please enter your recovery code.')
			return
		}
		

		setLoading(true)
		
		const canRestore  = await restoreWithRedeem (recoveryCode,'')
		setLoading(false)

		if (!canRestore) {
			setError('Invalid recovery code')
			return
		}

		
		onRestore(canRestore)
	}

		useEffect(() => {
	
							// 只在挂载时注册一次
			const off = onWalletEvent("scan:url", (url: string) => {
				if (/^0x/i.test(url)||/^http/i.test(url)) {
					setError('Invalid recovery code from scan')
					return
				}
				if (url?.length) {
					setRecoveryCode(url)
					return
				}
			})
					// 卸载时把监听取消，避免旧实例继续吃事件
			return () => {
				if (typeof off === 'function') off()
			}
	
		}, [])

	const onOpenScanner = () => {

	}

	return (
		<form
		onSubmit={handleSubmit}
		className="flex flex-col gap-4 text-[13px] text-slate-900 flex-1 px-6 pt-8 pb-10"
		>
			{/* 小标题 */}
			<div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
				Restore · Method 1
			</div>

			{/* 标题 */}
			<h1 className="text-[22px] font-semibold text-slate-900">
				Restore with Recovery QR
			</h1>

			{/* 说明文字 */}
			<p className="mt-1 text-[14px] text-slate-500 leading-snug">
				Scan your QR or paste your recovery code.
			</p>

			{/* QR 相机区域（小正方形居中） */}
			{
				!recoveryCode.length && (
					<>
						<div className="mt-6 w-full flex justify-center">
							<div
								className="
								rounded-[24px] border border-dashed border-slate-200
								bg-slate-50
								flex items-center justify-center
								cursor-pointer
								w-[5rem] h-[5rem]      /* ⭐ 正方形大小，可调 */
								"
								onClick={onOpenScanner}
							>
								<ScanBtn />
							</div>
						</div>

						{/* or 分隔 */}
						<div className="flex items-center justify-center my-2">
							<span className="text-[11px] text-slate-400">or</span>
						</div>
					</>
				)
			}


			

			{/* Recovery code S */}
			<div className="flex flex-col gap-1.5">
				
				<textarea
					className="
						w-full rounded-[18px] border border-slate-200 bg-white
						px-3 py-3 text-[13px] text-slate-900
						placeholder:text-slate-400 outline-none
						focus:border-sky-400 focus:ring-2 focus:ring-sky-100
						min-h-[88px]
					"
					placeholder="Recovery code"
					value={recoveryCode}
					onChange={e => setRecoveryCode(e.target.value)}
				/>
				
			</div>

			

			{/* 隐私说明卡片 */}
			<div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
				<div className="text-[12px] font-semibold text-amber-900 mb-1">
					Note
				</div>
				<p className="text-[11px] leading-snug text-amber-900/90">
					Restores locally on this device.
				</p>
			</div>

			{/* 底部错误信息 */}
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
			<div className="mt-6">
				<AppButton
					type="submit"
					fullWidth
					disabled={loading||!!error}
					className="rounded-[999px] py-3 text-[15px] font-semibold"
				>
					{loading ? 'Restoring…' : 'Restore wallet'}
				</AppButton>
			</div>
		</form>
	)
}

export default RestoreWithQRScreen