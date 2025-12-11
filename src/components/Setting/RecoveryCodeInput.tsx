import { useState } from "react"
import { Check, Loader2, BadgeCheck, Search, CheckCheck, ArrowRight, HelpCircle, CheckCircle2 } from "lucide-react"
import ScanBtn from "@/components/scanBtn/ScanButton"
import { getUserInfo, storeSystemData, restoreWithUserPin } from "@/services/beamio"
import { useDaemonContext } from '@/providers/DaemonProvider'

type prof = {
	pin: (val: string) => void
}

export const RecoveryInputs = ({pin}: prof) => {
	const [qrValue, setQrValue] = useState("")
	const [qrError, setQrError] = useState("")    // 🔥 新增错误状态
	const { beamio, profiles } = useDaemonContext()

	const [codeValue, setCodeValue] = useState("")
	const [codeStatus, setCodeStatus] =
   	 useState<"idle" | "loading" | "error" | "success">("idle")


  const testCode = async () => {
		if (!codeValue || !beamio) return
		setCodeStatus("loading")
		const kk = await restoreWithUserPin(beamio.accountName, codeValue, true)
		
		if (!kk ) {
			return setCodeStatus('error')
		}
		setCodeStatus('success')
		pin(codeValue)
  }

  return (
		<div className="flex flex-col gap-4 w-full">

		{/* -------------------- Recovery CODE INPUT with Test button -------------------- */}
		<div
			className="
			flex items-center 
			rounded-2xl bg-slate-50 border border-slate-200
			focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100
			overflow-hidden
			"
		>
			{/* 左侧 label */}
			<span className="px-3 text-sm text-slate-500 whitespace-nowrap">
				PIN
			</span>

			{/* 输入框 */}
			<input
				type="text"
				value={codeValue}
				onChange={e => {
							setCodeValue(e.target.value)
							setCodeStatus("idle")
				}}
				placeholder="Enter PIN"
				className="
						flex-1 bg-transparent outline-none 
						text-sm py-3 
						placeholder:text-slate-400
				"
			/>

			{/* 右侧状态 + 按钮区 */}
			<div className="mr-2 flex items-center justify-center min-w-[70px]">
			{codeStatus === "loading" && (
					<Loader2 className="w-4 h-4 animate-spin text-sky-600" />
			)}

			{codeStatus === "error" && (
					<span className="text-xs text-rose-600 font-medium">
						Code error
					</span>
			)}

			{codeStatus === "success" && (
					<Check className="w-5 h-5 text-emerald-500" />
			)}

			{codeStatus === "idle" && (
				<button
					onClick={testCode}
					className="
						h-8 px-3 rounded-full bg-sky-500 hover:bg-sky-600
						text-white text-xs font-semibold transition-all
						active:scale-95 flex items-center gap-1
					"
				>
					<ArrowRight className="w-4 h-4" />
				</button>
			)}
			</div>
		</div>
		</div>
  	)
}
