import React, { useState } from "react"
import SearchInputWithDropdown from "./SearchBarWithResults"
import { ChevronLeft } from "lucide-react"

type Props = {
  close: (path: string | searchResult) => void
}

export default function BeamioSearch({ close }: Props) {

  return (
    <div
      className="
        flex items-center
        px-6 pb-3
        border-slate-100
      "
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
      }}
    >
      <main className="flex-1">
        <section className="relative">
          <SearchInputWithDropdown
            showHistory={true}
            // ✅ readonly(假input) 时：先切到可输入模式，不要立刻 close
            close={path => {
            
              // ✅ 真输入模式下才走你原本的 close 逻辑
              if (path) close(path)
              else close("/")
            }}
			focus={true}
			
          />
        </section>
      </main>
    </div>
  )
}