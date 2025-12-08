import React from "react"
import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

type AppButtonProps = {
  variant?: ButtonVariant
  loading?: boolean          // 是否加载中
  errorText?: string  // 如果传了 error 文案，会变成红色按钮
  fullWidth?: boolean        // 是否占满一行
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const baseClasses = `
  inline-flex items-center justify-center
  rounded-xl text-sm font-medium
  active:scale-[0.97] transition
  focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
`

const sizeClasses = `
  h-11 px-4
`

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    text-white
    bg-gradient-to-r from-sky-500 to-blue-500
    hover:from-sky-500 hover:to-blue-600
    disabled:opacity-80 disabled:cursor-not-allowed
  `,
  secondary: `
    text-current
    border border-current/30
    bg-transparent
    hover:bg-current/5
    disabled:opacity-60 disabled:cursor-not-allowed
  `,
  ghost: `
    text-current
    bg-transparent
    hover:bg-current/5
    disabled:opacity-60 disabled:cursor-not-allowed
  `,
  danger: `
    text-white
    bg-red-700 hover:bg-red-700
    disabled:opacity-80 disabled:cursor-not-allowed
  `,
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

  // 👇 各个 variant 对应的 loading 点颜色
  const loadingDotColor =
    finalVariant === "primary" || finalVariant === "danger"
      ? "bg-white/80"
      : "bg-slate-900 dark:bg-slate-100" // secondary / ghost：亮色和暗色都看得见

  return (
    <div className={`${widthClass} my-1`}>
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
          <span className="flex items-center justify-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${loadingDotColor} animate-pulse`} />
            <span className={`w-1.5 h-1.5 rounded-full ${loadingDotColor} animate-pulse [animation-delay:80ms]`} />
            <span className={`w-1.5 h-1.5 rounded-full ${loadingDotColor} animate-pulse [animation-delay:160ms]`} />
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {leftIcon ? <span className="inline-flex items-center">{leftIcon}</span> : null}
            <span>{errorText || children}</span>
            {rightIcon ? <span className="inline-flex items-center">{rightIcon}</span> : null}
          </span>
        )}
      </button>
    </div>
  )
}
