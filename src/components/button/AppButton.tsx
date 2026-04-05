import React from "react"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

type AppButtonProps = {
  variant?: ButtonVariant
  loading?: boolean
  errorText?: string
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const baseClasses = `
  inline-flex items-center justify-center
  rounded-2xl
  font-semibold
  active:scale-[0.98]
  transition
  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300
  shadow-[0_14px_40px_rgba(37,99,235,0.28)]
`

// 更像截图的大按钮
const sizeClasses = `
  h-14 px-6 text-[18px] tracking-[-0.01em]
`

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    text-white
    bg-blue-600 hover:bg-blue-700
    disabled:opacity-60 disabled:cursor-not-allowed
  `,
  secondary: `
    text-slate-900
    bg-slate-100
    hover:bg-slate-200
    disabled:opacity-60 disabled:cursor-not-allowed
  `,
  ghost: `
    text-slate-900
    bg-transparent
    hover:bg-slate-100
    disabled:opacity-60 disabled:cursor-not-allowed
  `,
  danger: `
    text-white
    bg-red-600 hover:bg-red-700
    disabled:opacity-60 disabled:cursor-not-allowed
    shadow-[0_14px_40px_rgba(239,68,68,0.22)]
  `
}

export function AppButton({
  variant = "primary",
  loading,
  errorText = '',
  fullWidth,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...rest
}: AppButtonProps) {
  const finalVariant: ButtonVariant = errorText.length ? "danger" : variant
  const isDisabled = disabled || loading
  const widthClass = fullWidth ? "w-full" : ""

  const loadingDotColor =
    finalVariant === "primary" || finalVariant === "danger"
      ? "bg-white/85"
      : "bg-slate-900"

  return (
    <div className={widthClass}>
      <button
        disabled={isDisabled}
        className={`
          ${baseClasses}
          ${sizeClasses}
          ${variantClasses[finalVariant]}
          ${widthClass}
          ${className}
        `}
        {...rest}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${loadingDotColor} animate-pulse`} />
            <span className={`w-2 h-2 rounded-full ${loadingDotColor} animate-pulse [animation-delay:90ms]`} />
            <span className={`w-2 h-2 rounded-full ${loadingDotColor} animate-pulse [animation-delay:180ms]`} />
          </span>
        ) : (
          <span className="inline-flex w-full items-center justify-center gap-2">
            {leftIcon ? <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span> : null}
            <span className="inline-flex items-center leading-none">{errorText || children}</span>
            {rightIcon ? <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span> : null}
          </span>
        )}
      </button>
    </div>
  )
}
