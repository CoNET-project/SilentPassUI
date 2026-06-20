import { ChevronLeft } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { tu } from '@/locale/beamioLocale'

const NavigateLeftButton = () => {
  const { navigateLeftButtonArray, setNavigateLeftButtonArray } = useDaemonContext()

  const last = navigateLeftButtonArray[navigateLeftButtonArray.length - 1]
  const canBack = navigateLeftButtonArray.length > 0

  return (
    <div className="">
      {canBack && (
        <div
          className="
            h-10 w-full flex items-center relative bg-transparent
          "
        >
			<button
			type="button"
			onClick={() => {
				const next = [...navigateLeftButtonArray]
				const obj = next.pop()
				if (!obj) return

				setNavigateLeftButtonArray(next)
				;(obj.action ?? []).forEach(fn => fn())
			}}
			className="
				w-9 h-9
				rounded-full
				bg-white/30 dark:bg-slate-900/50
				backdrop-blur-md
				shadow-[0_4px_10px_rgba(0,0,0,0.12)]
				ring-1 ring-black/5
				outline outline-1 outline-white/40   /* 👈 新增外框 */
				outline-offset-0
				flex items-center justify-center
				text-slate-800 dark:text-slate-100
				active:scale-95
				transition
			"
			aria-label={tu('back')}
			>
			<ChevronLeft className="w-5 h-5 stroke-[2.5]" />
			</button>

          <div className="absolute left-1/2 -translate-x-1/2 text-[20px] font-semibold text-slate-900 dark:text-slate-100">
            {last?.title ?? ""}
          </div>

          <div className="w-9 h-9" />
        </div>
      )}
    </div>
  )
}

export default NavigateLeftButton
