import { useState } from "react"
import { Check, Copy } from "lucide-react"

export default function AddressCard({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="
      w-full rounded-2xl px-4 py-3
      border border-black/10 bg-white/60
      dark:border-white/10 dark:bg-white/5
      backdrop-blur-sm
    ">
      {/* Label */}
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        Your Beamio address
      </div>

      {/* Address + Copy */}
      <div className="flex items-center gap-2">
        <div className="
          flex-1 text-sm font-mono truncate
          text-slate-800 dark:text-slate-50
        ">
          {address}
        </div>

        <button
          onClick={onCopy}
          className="
            px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1
            bg-gradient-to-r from-sky-500 to-blue-500 text-white
            active:scale-[0.97] transition
          "
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      {/* Description */}
      <div className="
        mt-2 text-[11px] leading-relaxed
        text-slate-600 dark:text-slate-500
      ">
        Use this address to receive USDC on Base via Beamio or any compatible wallet.
      </div>
    </div>
  )
}
