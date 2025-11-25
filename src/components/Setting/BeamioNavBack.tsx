import { ArrowLeft } from 'lucide-react'

export default function BeamioNavBack({ title, onClose }: {title: string, onClose: () => void }) {
  return (
    <header className="
      sticky top-0 z-10 
      flex items-center gap-3 
      px-4 py-3
      bg-white/90 dark:bg-slate-900/80
      backdrop-blur-md
      border-b border-slate-200 dark:border-slate-700
    ">
      <button
        onClick={onClose}
        className="
          flex h-8 w-8 items-center justify-center
          rounded-full 
          active:bg-slate-200/60 dark:active:bg-slate-700/40
          transition
        "
      >
        <ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-200" />
      </button>

      <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>
    </header>
  )
}
