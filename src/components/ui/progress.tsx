/* ============================
   src/components/ui/progress.tsx
============================ */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number // 0–100
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-200", className)} {...props}>
      <div
        className="h-full w-full flex-1 bg-slate-900 transition-all"
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"
