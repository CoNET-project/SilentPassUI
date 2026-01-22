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
		mt-4
      "
      
    >
      <main className="flex-1">
        <section className="relative">
          <SearchInputWithDropdown
            showHistory={true}
            // ✅ readonly(假input) 时：先切到可输入模式，不要立刻 close
            closeWindow={path => {
            
              // ✅ 真输入模式下才走你原本的 close 逻辑
              if (path) close(path)
              	else close("/")
            }}
			focus={true}
			select={true}
          />
        </section>
      </main>
    </div>
  )
}