import React, {
  useState,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react"
import { AppButton } from "@/components/button/AppButton"
import { formatAmountReadable } from "@/services/beamio"
import MemoizedReadableAmount from "./HumanReadableAmount" // 按你实际导出名调整

type CheckInputSectionProps = {
  currency: string
  defaultNote: string
  defaultAmount: number
  validityDays: number
  cancellable: boolean
  // 父组件在 Next 被点击且校验通过后收到数据
  onNext: (v: {
    note: string
    amount: number
    amountText: string
    fee: number
    net: number
  }) => void
  nextLabel?: string
  loadingNext?: boolean   // 父容器可以控制按钮 loading
}

export type CheckInputSectionHandle = {
  focusAmount: () => void
}

const formatMoney = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  

const CheckInputSection = forwardRef<CheckInputSectionHandle, CheckInputSectionProps>(
  (
    {
      currency,
      defaultNote,
      defaultAmount,
      validityDays,
      cancellable,
      onNext,
      nextLabel = "next",
      loadingNext = false,
    },
    ref
  ) => {
    // 备注
    const [note, setNote] = useState<string>(defaultNote)
    // 金额文本（输入框里的字符串）
    const [amountText, setAmountText] = useState<string>(defaultAmount.toFixed(2))
    const [error, setError] = useState<string>("")
    const inputRef = useRef<HTMLInputElement | null>(null)

    // 解析金额为 number
    const amount = useMemo(() => {
      const v = Number(String(amountText).replace(/,/g, ""))
      if (!Number.isFinite(v)) return 0
      return v
    }, [amountText])

    // 手续费 & 实际到账
    // 按你之前要求：fee 0.8%，最少 0.02，最大 2.00
    const { fee, net } = useMemo(() => {
      let feeVal = amount * 0.008
      if (feeVal < 0.02) feeVal = 0.02
      if (feeVal > 2.0) feeVal = 2.0
      const netVal = Math.max(amount - feeVal, 0)
      return { fee: feeVal, net: netVal }
    }, [amount])

    // 人类可读金额（你想用 amount 还是 net 自己选，这里用 net）
    const readable = useMemo(() => {
      return formatAmountReadable(Number(net || 0), "en", "usd")
    }, [net])

    // 备注 focus/blur 行为
    const handleNoteFocus = () => {
      if (note === defaultNote) setNote("")
    }

    const handleNoteBlur = () => {
      if (note.trim() === "") setNote(defaultNote)
    }

    // 校验金额
    const validate = (): boolean => {
      const v = Number(String(amountText).replace(/,/g, ""))

      if (isNaN(v)) {
        setError("Please enter a valid number")
        return false
      }

      if (v < 0.02) {
        setError("Amount must be ≥ 0.02")
        return false
      }

      setError("")
      return true
    }

    const handleAmountBlur = () => {
      if (!validate()) return
      // 校验通过再格式化
      const v = Number(String(amountText).replace(/,/g, ""))
      setAmountText(formatMoney(v))
    }

    const handleNextClick = () => {
      if (!validate()) return
      const v = Number(String(amountText).replace(/,/g, ""))

      onNext({
        note,
        amount: v,
        amountText,
        fee,
        net,
      })
    }

    useImperativeHandle(ref, () => ({
      focusAmount: () => {
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        })
      },
    }))

    return (
      <div>
        {/* 备注输入栏 */}
        <div>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onFocus={handleNoteFocus}
            onBlur={handleNoteBlur}
            placeholder={defaultNote}
            className="
              w-full border-0 border-b border-current/25
              bg-transparent outline-none
              text-xs text-current pb-0
              placeholder:text-current/45
              focus:border-current/60
              transition-colors
            "
          />
        </div>

        <div className="rounded-3xl p-5 md:p-6 max-w-md">
          {/* 金额输入 + 人类可读 */}
          <input
            ref={inputRef}
            value={amountText}
            inputMode="decimal"
            type="text"
            onChange={e => {
              setAmountText(e.target.value)
              if (error) setError("")
            }}
            onBlur={handleAmountBlur}
            placeholder="0.00"
            style={{
              fontSize: "45px",
              textAlign: "right",
              transition: "all 0.2s ease",
            }}
            className="
              w-full bg-transparent outline-none
              leading-none font-semibold tracking-wide text-slate-800
            "
          />

          <MemoizedReadableAmount readable={readable} lang="en" />
        </div>

        {error ? (
          <div
            className="mt-2 text-[13px] text-red-600"
            aria-live="polite"
          >
            {error}
          </div>
        ) : null}

        {/* 实际到账 */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-current/70">收款</span>
          <span className="text-[20px] font-semibold text-current">
            {formatMoney(net)} {currency}
          </span>
        </div>

        {/* 底部提示行 */}
        <div className="text-xs text-current/60 text-right -mt-1">
          Fee: {formatMoney(fee)} {currency}
        </div>

        <div className="mt-2 flex items-center justify-between text-sm text-current/70">
          <span>Valid for {validityDays} days</span>
          <span>{cancellable ? "Cancellable" : "\u00A0"}</span>
        </div>

        {/* Next 按钮 */}
        <div className="mt-4">
          <AppButton
            variant="primary"
            fullWidth
            loading={loadingNext}
            className="my-0"
            onClick={handleNextClick}
          >
            {nextLabel}
          </AppButton>
        </div>
      </div>
    )
  }
)

export default CheckInputSection
