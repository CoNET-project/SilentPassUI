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
					Restore wallet
				</div>

				{/* 标题 */}
				<h1 className="text-[26px] font-semibold text-slate-900">
					Restore your wallet
				</h1>

				{/* 副标题 */}
				<p className="mt-1 text-[14px] text-slate-500 leading-snug">
					Choose a restore method.
				</p>

				{/* 按钮区域（按图：两张卡片 + 各自一个大按钮） */}
				<div className="mt-6 space-y-5">
				{/* Card 1 */}
				<div
					className="
					rounded-[28px]
					bg-white
					border border-slate-200/70
					shadow-[0_10px_24px_rgba(15,23,42,0.06)]
					px-5 pt-5 pb-5
					"
				>
					<div className="text-[14px] font-semibold text-slate-900">
						Recovery QR / code
					</div>
					<div className="mt-2 text-[14px] leading-snug text-slate-500">
						Scan QR or paste a recovery code.
					</div>

					<div className="mt-5">
					<AppButton
						fullWidth
						className="rounded-[999px] h-14 text-[20px] font-semibold"
						onClick={onUseRecoveryQR}
					>
						Scan QR / enter code
					</AppButton>
					</div>
				</div>

				{/* Card 2 */}
				<div
					className="
					rounded-[28px]
					bg-white
					border border-slate-200/70
					shadow-[0_10px_24px_rgba(15,23,42,0.06)]
					px-5 pt-5 pb-5
					"
				>
					<div className="text-[14px] font-semibold text-slate-900">
						BeamioTag + Password
					</div>
					<div className="mt-2 text-[14px] leading-snug text-slate-500">
						Restore using your tag and password.
					</div>

					<div className="mt-5">
					<button
						type="button"
						onClick={onUseUsernamePin}
						className="
						w-full h-14
						rounded-[22px]
						bg-white
						border border-slate-200
						text-[16px] font-semibold text-slate-900
						shadow-[0_10px_22px_rgba(15,23,42,0.08)]
						active:scale-[0.99]
						transition
						"
					>
						Use @BeamioTag + Password
					</button>
					</div>
				</div>

				{/* Card 2 */}
				<div
					className="
					rounded-[28px]
					bg-white
					border border-slate-200/70
					shadow-[0_10px_24px_rgba(15,23,42,0.06)]
					px-5 pt-5 pb-5
					"
				>
					<div className="text-[14px] font-semibold text-slate-900">
						No centralized database
					</div>
					<div className="mt-2 text-[14px] leading-snug text-slate-500">
						Beamio stores only an encrypted backup record on-chain. Your secrets decrypt it locally.
					</div>

				</div>
				</div>

			</div>
		</div>
	)

	export default RestoreEntryScreen