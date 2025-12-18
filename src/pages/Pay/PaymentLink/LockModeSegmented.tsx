import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { Globe } from 'lucide-react'

function LockModeSwitch({
  value,
  onChange,
}: {
  value: PaymentLinkLockMode
  onChange: (v: PaymentLinkLockMode) => void
}) {
  const isUSDC = value === 'USDC_LOCKED'

  return (
    <div className="flex items-center justify-between gap-3">
      {/* 左侧内容（单层 DOM，opacity 切换） */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Icon */}
        <div className="relative w-6 h-6 flex-shrink-0">
          <Globe
            className={`
              absolute inset-0 w-6 h-6
              text-slate-500
              transition-opacity duration-150
              ${isUSDC ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            `}
            aria-hidden={isUSDC}
          />

          <div
            className={`
              absolute inset-0
              transition-opacity duration-150
              ${isUSDC ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
            aria-hidden={!isUSDC}
          >
            <img
              src={usdcIcon}
              alt="USDC"
              className="w-6 h-6 rounded-full object-contain"
            />
            <img
              src={baseIcon}
              alt="Base"
              className="
                absolute -bottom-0.5 -right-0.5
                w-3 h-3
                rounded-full
                border border-white dark:border-slate-900
                bg-white
              "
            />
          </div>
        </div>

        {/* Text（真正单层：内容直接切换，不叠） */}
        <div className="min-w-0 transition-opacity duration-150">
          <div className="text-sm font-semibold text-slate-900 leading-snug">
            {isUSDC ? 'USDC' : 'Local currency'}
          </div>
          <div className="text-xs text-slate-500 leading-snug">
            {isUSDC
              ? 'Fiat shown as reference'
              : 'USDC quoted at checkout'}
          </div>
        </div>
      </div>

      {/* 右侧 iOS 蓝色 Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={isUSDC}
        onClick={() => onChange(isUSDC ? 'FIAT_LOCKED' : 'USDC_LOCKED')}
        className={`
          relative inline-flex
          w-[44px] h-[26px]
          flex-shrink-0
          rounded-full
          transition-colors duration-200
          focus:outline-none
          focus:ring-2 focus:ring-blue-300
          ${isUSDC ? 'bg-blue-500' : 'bg-slate-300'}
        `}
      >
        <span
          className={`
            absolute top-[2px]
            w-[22px] h-[22px]
            rounded-full
            bg-white
            shadow
            transition-transform duration-200
            ${isUSDC ? 'translate-x-[18px]' : 'translate-x-[2px]'}
          `}
        />
      </button>
    </div>
  )
}

export default LockModeSwitch
