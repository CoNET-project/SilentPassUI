import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  createNumericInputWheelNonPassiveRefCallback,
  preventNumericInputStepKeys,
} from '@/utils/numericInputStepKeys'

/** Left-of-thumb track fill — dark (see beamio-percent-slider-protocol.mdc). */
export const BEAMIO_PERCENT_SLIDER_TRACK_FILL = '#2c2f31'
/** Unfilled track to the right of the thumb. */
export const BEAMIO_PERCENT_SLIDER_TRACK_REST = '#e5e7eb'

export type BeamioPercentSliderAccent = 'purple' | 'blue'

const ACCENT: Record<
  BeamioPercentSliderAccent,
  { thumb: string; valueText: string; valueShell: string; tick: string }
> = {
  purple: {
    thumb: '#8d3a8b',
    valueText: 'text-[#8d3a8b]',
    valueShell: 'border-[#eadcf7] bg-[#f5ecff]',
    tick: 'text-[#8d3a8b]/70',
  },
  blue: {
    thumb: '#0051d1',
    valueText: 'text-[#0051d1]',
    valueShell: 'border-[#dce2f7] bg-[#e9edff]',
    tick: 'text-[#0051d1]/70',
  },
}

/** Clamp to 0–100 with 0.01 resolution. */
function clampPercentHundredths(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100))
}

function formatPercentDisplay(pct: number): string {
  const hundredths = Math.max(0, Math.min(10_000, Math.round(pct * 100)))
  const whole = Math.trunc(hundredths / 100)
  const frac = hundredths % 100
  if (frac === 0) return String(whole)
  if (frac % 10 === 0) return `${whole}.${frac / 10}`
  return `${whole}.${String(frac).padStart(2, '0')}`
}

export type BeamioPercentSliderProps = {
  id: string
  /** Accessible name for the range + percent field (English). */
  label: ReactNode
  /** When set, shown as the visible label; otherwise `label` is used. */
  labelContent?: ReactNode
  value: number
  onChange: (next: number) => void
  disabled?: boolean
  accent?: BeamioPercentSliderAccent
  /** Show 0% / 50% / 100% under the track. Default true. */
  showTicks?: boolean
  className?: string
  labelClassName?: string
  focusRingClassName?: string
}

/**
 * 0–100% slider (0.01 steps): dark fill left of thumb + focusable percent number input.
 * @see `.cursor/rules/beamio-percent-slider-protocol.mdc`
 */
export function BeamioPercentSlider({
  id,
  label,
  labelContent,
  value,
  onChange,
  disabled = false,
  accent = 'blue',
  showTicks = true,
  className = '',
  labelClassName = 'min-w-0 font-manrope text-sm font-bold text-[#2c2f31]',
  focusRingClassName = '',
}: BeamioPercentSliderProps) {
  const pct = clampPercentHundredths(value)
  const theme = ACCENT[accent]
  const numberId = `${id}-value`
  const [draft, setDraft] = useState<string | null>(null)
  const wheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])

  const commitDraft = (raw: string) => {
    const next = clampPercentHundredths(raw.trim() === '' ? 0 : raw)
    onChange(next)
    setDraft(null)
  }

  const trackStyle = {
    background: `linear-gradient(to right, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} 0%, ${BEAMIO_PERCENT_SLIDER_TRACK_FILL} ${pct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} ${pct}%, ${BEAMIO_PERCENT_SLIDER_TRACK_REST} 100%)`,
  } as const

  const thumbClass =
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer' +
    ' [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer'

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelClassName}>
          {labelContent ?? label}
        </label>
        <div
          className={`flex min-h-[2.25rem] shrink-0 items-center justify-center gap-0.5 rounded-lg border px-2 py-1 ${theme.valueShell}`}
        >
          <input
            ref={wheelRef}
            id={numberId}
            type="number"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            min={0}
            max={100}
            step={0.01}
            disabled={disabled}
            value={draft ?? formatPercentDisplay(pct)}
            aria-label={typeof label === 'string' ? label : 'Percent'}
            onFocus={() => setDraft(formatPercentDisplay(pct))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft === null) return
              commitDraft(draft)
            }}
            onKeyDown={(e) => {
              preventNumericInputStepKeys(e)
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className={`w-14 bg-transparent text-center font-manrope text-[15px] font-bold tabular-nums outline-none ${theme.valueText} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClassName}`}
          />
          <span className={`shrink-0 text-[12px] font-bold ${theme.valueText}`} aria-hidden>
            %
          </span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={0.01}
        value={pct}
        disabled={disabled}
        onChange={(e) => {
          setDraft(null)
          onChange(clampPercentHundredths(e.target.value))
        }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${formatPercentDisplay(pct)}%`}
        aria-label={typeof label === 'string' ? label : 'Percent'}
        style={
          {
            ...trackStyle,
            accentColor: theme.thumb,
            ['--beamio-percent-thumb' as string]: theme.thumb,
          } as CSSProperties
        }
        className={`h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-60 ${thumbClass} [&::-webkit-slider-thumb]:bg-[var(--beamio-percent-thumb)] [&::-moz-range-thumb]:bg-[var(--beamio-percent-thumb)] [&::-moz-range-track]:bg-transparent ${focusRingClassName}`}
      />
      {showTicks ? (
        <div className={`flex justify-between px-0.5 text-[11px] font-medium ${theme.tick}`}>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      ) : null}
    </div>
  )
}
