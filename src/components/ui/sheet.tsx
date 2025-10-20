/* ============================
   src/components/ui/sheet.tsx
   (Radix Dialog as bottom sheet)
============================ */
import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger

export const SheetContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: "bottom" | "left" | "right" | "top" }>(
  ({ className, side = "bottom", ...props }, ref) => (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed z-50 w-full bg-white shadow-xl outline-none",
          side === "bottom" && "left-0 right-0 bottom-0 rounded-t-2xl",
          side === "top" && "left-0 right-0 top-0 rounded-b-2xl",
          side === "left" && "left-0 top-0 h-full max-w-sm rounded-r-2xl",
          side === "right" && "right-0 top-0 h-full max-w-sm rounded-l-2xl",
          className
        )}
        {...props}
      />
    </Dialog.Portal>
  )
)
SheetContent.displayName = "SheetContent"

export const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-1", className)} {...props} />
)

export const SheetTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof Dialog.Title>>(
  ({ className, ...props }, ref) => (
    <Dialog.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
  )
)
SheetTitle.displayName = "SheetTitle"