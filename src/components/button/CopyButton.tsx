import { useState } from "react"
import { Check } from "lucide-react"
import { tu } from '@/locale/beamioLocale'

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

  return (
    <button
      onClick={handleCopy}
      className={`
        ml-2 text-[10px] md:text-[11px]
        font-medium
        text-blue-600 dark:text-blue-400
        flex items-center transition
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
