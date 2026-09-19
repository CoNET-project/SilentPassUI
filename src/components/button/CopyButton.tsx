import { useState } from "react"
import { Check } from "lucide-react"
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

interface CopyButtonProps {
  value: string            // ← 要复制的内容
  className?: string       // （可选）外部传入样式
}

const CopyButton = ({ value, className = "" }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error(tu('copy_failed'), err)
    }
  }
  const tap = useReliableTapHandler(() => {
    void handleCopy()
  })

  return (
    <button
      type="button"
      data-touch-priority="1"
      onPointerDown={tap.onPointerDown}
      onPointerUp={tap.onPointerUp}
      onClick={tap.onClick}
      className={`
        ml-2 text-[10px] md:text-[11px]
        font-medium
        text-blue-600 dark:text-blue-400
        flex items-center transition
        ${RELIABLE_TAP_BUTTON_CLASS}
        ${className}
      `}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        tu('copy')
      )}
    </button>
  )
}

export default CopyButton
