import React from "react";
import SearchInputWithDropdown, {searchResult} from './SearchBarWithResults'
import { ChevronLeft } from 'lucide-react'

type Props = {
	close: (path: string) => void
}

export default function BeamioSearch({close}: Props) {

return (
  <div className="mt-0 flex items-center px-6 pt-4 pb-3 border-slate-100">
    <main className="flex-1">
      <section className="flex items-center gap-2">
        {/* ← 返回按钮 */}
        <button
          type="button"
          onClick={() => close('/')}
          className="
            w-9 h-9
            flex items-center justify-center
            rounded-full
            hover:bg-slate-100
            active:scale-95
            transition
          "
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>

        {/* SearchInput */}
        <div className="flex-1">
          <SearchInputWithDropdown
            readonly={false}
            close={path => {
              if (typeof path === 'string') {
                close(path)
              } else {
                close('/')
              }
            }}
          />
        </div>
      </section>
    </main>
  </div>
)
}
