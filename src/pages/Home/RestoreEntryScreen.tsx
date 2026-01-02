import { AppButton } from '@/components/button/AppButton'


type RestoreEntryScreenProps = {
  onUseRecoveryQR: () => void
  onUseUsernamePin: () => void
}

const RestoreEntryScreen = ({
	onUseRecoveryQR,
	onUseUsernamePin,
	}: RestoreEntryScreenProps) => (
		<div className="px-6 pt-8 pb-10">
			<div className="flex flex-col gap-4 text-[13px] text-slate-900 flex-1">
				{/* 小标题 */}
				<div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
					Restore account
				</div>

				{/* 标题 */}
				<h1 className="text-[26px] font-semibold text-slate-900">
					Restore your Beamio account
				</h1>

				{/* 副标题 */}
				<p className="mt-1 text-[14px] text-slate-500 leading-snug">
					Use your Recovery QR / code S, or restore via @BeamioTag + PIN with our
					encrypted backup.
				</p>

				{/* 按钮区域 */}
				<div className="mt-6 flex flex-col gap-3">
					{/* 主按钮 */}
					<div className="flex flex-col gap-1.5">
						<AppButton
							fullWidth
							className="rounded-[999px] py-3 text-[15px] font-semibold"
							onClick={onUseRecoveryQR}
						>
							Use Recovery QR / code S
						</AppButton>

						<p className="text-[12px] text-slate-500">
							Recommended if you have your Recovery QR saved.
						</p>
					</div>

					{/* 次按钮 */}
					<AppButton
						fullWidth
						variant="secondary"
						className="rounded-[999px] py-3 text-[15px] font-semibold"
						onClick={onUseUsernamePin}
					>
						Use @BeamioTag + PIN
					</AppButton>
				</div>

				{/* 底部说明文字 */}
				<p className="mt-5 text-[11px] text-slate-500 leading-snug">
					Beamio never stores your private key. Your PIN, processed with scrypt,
					decrypts your encrypted backup locally on this device.
				</p>
			</div>
		</div>
	)

	export default RestoreEntryScreen