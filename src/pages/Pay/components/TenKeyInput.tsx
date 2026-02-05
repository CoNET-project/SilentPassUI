import React, { useState } from 'react'
import { Camera, QrCode } from 'lucide-react'
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import { useDaemonContext } from "@/providers/DaemonProvider"


//		
interface TenKeyInputProps {
	value: string
	onChange: (value: string) => void
	maxLength?: number
	allowDecimal?: boolean
	label?: string
	currency?: string
	onScanUser?: () => void
	onShowQR?: () => void
}

const TenKeyInput = ({ 
	value, 
	onChange, 
	maxLength = 10,
	allowDecimal = false,
	label = "ENTER CHARGE (CAD)",
	currency = "$",
	onScanUser,
	onShowQR
}: TenKeyInputProps) => {
	const handleKeyClick = (key: number | string) => {
		if (key === 'del') {
			onChange(value.slice(0, -1))
		} else {
			// 限制最大长度为 maxLength（默认 10 位）
			if (value.length < maxLength) {
				// 如果允许小数点，检查是否已经存在小数点
				if (key === '.' && allowDecimal) {
					if (!value.includes('.')) {
						onChange(value + key)
					}
				} else if (key !== '.') {
					onChange(value + key)
				}
			}
		}
	}

	// 格式化显示值：添加货币符号
	const displayValue = value ? `${currency}${value}` : `${currency}0`

	// 键盘布局：4x3 网格（按图片顺序：1-9, ., 0, del）
	const keys = allowDecimal 
		? [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'del']
		: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 'del']

	return (
		<div className="flex-1 flex flex-col h-full overflow-hidden">
			{/* 顶部显示区域 */}
			<div className="flex-1 flex flex-col items-center justify-center shrink-0 px-4">
				<p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-center">
					{label}
				</p>
				<div className="text-6xl font-black tracking-wider text-[#1d1d1f]">
					{displayValue}
				</div>
			</div>

			{/* 数字键盘区域 - 使用全高度，大号按键 */}
			<div className="grid grid-cols-3 gap-3 shrink-0 px-4 pb-4 mt-8">
				{keys.map((k) => (
					<button
						key={k}
						type="button"
						onClick={() => handleKeyClick(k)}
						className="h-28 bg-gray-50 rounded-2xl text-4xl font-bold hover:bg-gray-100 active:scale-95 transition-all text-[#1d1d1f] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
						disabled={k === 'del' && !value}
					>
						{k === 'del' ? '←' : k}
					</button>
				))}
			</div>

			{/* 底部操作按钮 */}
			{(onScanUser || onShowQR) && (
				<div className="grid grid-cols-2 gap-3 shrink-0 px-4 pb-4 mt-4">
					{onScanUser && (
						<button
							type="button"
							onClick={onScanUser}
							disabled={!value}
							className="h-20 rounded-2xl bg-[#1562f0] text-white shadow-xl flex flex-col items-center justify-center space-y-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<Camera size={24} />
							<span className="text-xs font-bold uppercase tracking-wider">SCAN USER</span>
						</button>
					)}
					{onShowQR && (
						<button
							type="button"
							onClick={onShowQR}
							disabled={!value}
							className="h-20 rounded-2xl bg-white border-2 border-[#1562f0] text-[#1562f0] flex flex-col items-center justify-center space-y-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
						>
							<QrCode size={24} />
							<span className="text-xs font-bold uppercase tracking-wider">SHOW QR</span>
						</button>
					)}
				</div>
			)}
		</div>
	)
}

const TenKeyInputComponent = () => {
	const [value, setValue] = useState('')
	const [showQRSheet, setShowQRSheet] = useState(false)
	const { beamio } = useDaemonContext()
	const maxLength = 10
	const allowDecimal = true

	const handleScanUser = () => {
		console.log('Scan User clicked')
		// TODO: 实现扫描用户功能
	}

	const handleShowQR = () => {
		if (!value) return
		// 组合 URL 字符串：http://beamio.app/Vouchers?Amount={value}
		setShowQRSheet(true)
	}

	// 组合支付链接 URL
	const paymentUrl = value ? `http://beamio.app/Vouchers?Amount=${value}` : ''

	return (
		<>
			<div className="h-full flex flex-col mt-16">
				<TenKeyInput
					value={value}
					onChange={setValue}
					maxLength={maxLength}
					allowDecimal={allowDecimal}
					label="ENTER CHARGE (CAD)"
					currency="$"
					onScanUser={handleScanUser}
					onShowQR={handleShowQR}
				/>
			</div>

			{/* 底部滑出窗口 - 显示二维码 */}
			<div
				className={[
					"fixed inset-0 z-50",
					showQRSheet ? "pointer-events-auto" : "pointer-events-none"
				].join(" ")}
			>
				{/* 灰色遮罩 */}
				<div
					className={[
						"absolute inset-0",
						"bg-black/50 transition-opacity duration-300 ease-out",
						showQRSheet ? "opacity-100" : "opacity-0"
					].join(" ")}
					onClick={() => setShowQRSheet(false)}
				/>

				{/* Bottom Sheet：从底部滑出 */}
				<div
					className={[
						"absolute inset-x-0 bottom-0",
						"transition-transform duration-300 ease-out",
						showQRSheet ? "translate-y-0" : "translate-y-full"
					].join(" ")}
					onTouchMove={(e) => e.stopPropagation()}
				>
					{/* Sheet 本体 */}
					<div
						className={[
							"w-full",
							"bg-white dark:bg-slate-900",
							"rounded-t-[32px]",
							"max-h-[90vh] overflow-y-auto"
						].join(" ")}
					>
						{/* 关闭按钮 */}
						<div className="sticky top-0 z-10 flex justify-end p-4 bg-white dark:bg-slate-900">
							<button
								type="button"
								onClick={() => setShowQRSheet(false)}
								className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									className="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						{/* ShowPayQR 组件内容 */}
						{paymentUrl && (
							<>
								<ShowPayQR
									successUrl={paymentUrl}
									beamio={beamio}
									amount={value}
									currency="$"
									hideActions={true}
									hideUrl={true}
								/>
								{/* 底部附加空间 */}
								<div className="h-64" />
							</>
						)}
					</div>
				</div>
			</div>
		</>
	)
}

export default TenKeyInputComponent;