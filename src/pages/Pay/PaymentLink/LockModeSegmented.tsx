/** Segmented Control (replaces ugly radio) */
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { Globe } from 'lucide-react'

function LockModeSegmented({
  value,
  onChange,
}: {
  value: PaymentLinkLockMode;
  onChange: (v: PaymentLinkLockMode) => void;
}) {
  const isFiat = value === "FIAT_LOCKED";

  const base = "flex-1 rounded-full px-4 py-3 text-left transition ring-1";
  const selected =
    "bg-blue-50 ring-blue-200 shadow-[0_1px_2px_rgba(15,23,42,0.06)]";
  const unselected = "bg-white ring-slate-200 hover:bg-slate-50";

  return (
    <div className="rounded-full bg-slate-50 p-1 ring-1 ring-slate-200">
      <div className="flex gap-1">
        <button
          type="button"
          aria-pressed={isFiat}
          onClick={() => onChange("FIAT_LOCKED")}
          className={`${base} ${isFiat ? selected : unselected}`}
        >
          <div className="flex items-center gap-2">
			<Globe className="w-5 h-5 text-slate-500" />

			<div>
				<div className="text-sm font-semibold text-slate-900">
				Local currency
				</div>
				<div className="text-xs text-slate-500">
				USDC quoted at checkout
				</div>
			</div>
			</div>
        </button>

        <button
          type="button"
          aria-pressed={!isFiat}
          onClick={() => onChange("USDC_LOCKED")}
          className={`${base} ${!isFiat ? selected : unselected}`}
        >
          <div className="flex items-center gap-2">
				<div
					className="
						relative
						flex-shrink-0
						w-5 h-5
						min-w-[16px] min-h-[16px]
					"
				>
					<img
						src={usdcIcon}
						alt="USDC"
						className="
							block
							w-5 h-5
							rounded-full
							object-contain
						"
					/>
					<img
						src={baseIcon}
						alt="Base"
						className="
							block
							w-2.5 h-2.5
							absolute -bottom-0.5 -right-0.5
							rounded-full
							border border-white dark:border-slate-900
							bg-white
						"
					/>
				</div>
            <div>
              <div className="text-sm font-semibold text-slate-900">USDC</div>
              <div className="text-xs text-slate-500">Fiat shown as reference</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}


export default LockModeSegmented