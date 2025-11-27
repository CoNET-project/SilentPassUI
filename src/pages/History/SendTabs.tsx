import { useState, useRef, useEffect } from "react"

export default function SendTabs() {
  const [tab, setTab] = useState<"recents" | "addresses">("recents")
  const underlineRef = useRef<HTMLDivElement>(null)
  const recentsRef = useRef<HTMLButtonElement>(null)
  const addressesRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const activeBtn = tab === "recents" ? recentsRef.current : addressesRef.current
    const underline = underlineRef.current
    if (activeBtn && underline) {
      const rect = activeBtn.getBoundingClientRect()
      const parentRect = activeBtn.parentElement!.getBoundingClientRect()

      underline.style.width = `${rect.width}px`
      underline.style.left = `${rect.left - parentRect.left}px`
    }
  }, [tab])

  return (
    <div className="w-full mt-8">
      <div className="relative flex items-center gap-8 text-sm font-medium mb-4 pb-1">

        <button
          ref={recentsRef}
          onClick={() => setTab("recents")}
          className={`
            transition-colors
            ${tab === "recents" ? "text-sky-400" : "text-slate-500 dark:text-slate-400"}
          `}
        >
          Recents
        </button>

        <button
          ref={addressesRef}
          onClick={() => setTab("addresses")}
          className={`
            transition-colors
            ${tab === "addresses" ? "text-sky-400" : "text-slate-500 dark:text-slate-400"}
          `}
        >
          My addresses
        </button>

        {/* underline */}
        <div
          ref={underlineRef}
          className="absolute bottom-0 h-0.5 bg-sky-500 rounded-full transition-all duration-300"
        />
      </div>

      {/* Content */}
      {tab === "recents" && (
        <div className="text-sm text-slate-400 dark:text-slate-500">
          No recent contacts.
          <div className="mt-4 text-xs text-slate-500">
            More recent contacts will appear here after you start sending.
          </div>
        </div>
      )}

      {tab === "addresses" && (
        <div className="text-sm text-slate-400 dark:text-slate-500">
          No saved addresses.
        </div>
      )}
    </div>
  )
}
