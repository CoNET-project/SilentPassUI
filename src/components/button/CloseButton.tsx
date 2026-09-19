import React from "react"
import { X } from "lucide-react"
import { tu } from '@/locale/beamioLocale'
import { useReliableTapHandler, RELIABLE_TAP_BUTTON_CLASS } from '@/utils/reliableTap'

type Props = {
  onClick: () => void
  className?: string
  ariaLabel?: string
}

/**
 * iOS style bounce:
 * hover/press -> scale 1.5 quickly
 * release -> 1.5 -> 0.8 quickly -> 1.0 slowly
 */
export default function IOSBounceCloseButton({
	onClick,
	className = "",
	ariaLabel = tu('close')
}: Props) {
  const tap = useReliableTapHandler(onClick)
  return (
    <>
      <button
        type="button"
        data-touch-priority="1"
        onPointerDown={tap.onPointerDown}
        onPointerUp={tap.onPointerUp}
        onClick={tap.onClick}
        aria-label={ariaLabel}
        className={[
          "ios-bounce-btn",
          "inline-flex items-center justify-center",
          "w-10 h-10 rounded-full",
          "bg-black/5 border border-white",
          "backdrop-blur",
          "will-change-transform",
          "select-none",
          RELIABLE_TAP_BUTTON_CLASS,
          className
        ].join(" ")}
      >
        <X className="w-5 h-5 text-white/80" />
      </button>

      <style>{`
        /* baseline */
        .ios-bounce-btn {
          transform: scale(1);
          transition: transform 300ms ease-out;
        }

        /* fast grow on hover / press */
        .ios-bounce-btn:hover {
          transform: scale(1.2);
          transition-duration: 75ms;
        }

        .ios-bounce-btn:active {
          transform: scale(1.5);
          transition-duration: 75ms;
        }

        /* release bounce: 1.5 -> 0.8 -> 1.0 */
        .ios-bounce-btn:not(:hover):not(:active) {
          animation: iosBounceBack 420ms cubic-bezier(.34,1.56,.64,1);
        }

        @keyframes iosBounceBack {
          0% { transform: scale(1.5); }
          40% { transform: scale(0.8); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  )
}
