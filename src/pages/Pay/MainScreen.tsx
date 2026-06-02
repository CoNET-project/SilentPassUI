import { IpfsImg } from '@/components/IpfsImg';
import { ChevronRight } from 'lucide-react'
import payIcon from '@/pages/Pay/assets/Pay.svg'
import cashcodeIcon from '@/pages/Pay/assets/cashcode.svg'
import rlIcon from '@/pages/Pay/assets/requestLink.svg'
import pmIcon from '@/pages/Pay/assets/linkP.svg'

type Action = 'pay' | 'cashcode' | 'request-link' | 'payme-qr'

export default function MainScreen({
  onAction
}: {
  onAction?: (action: Action) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 mt-2">
  {/* Pay someone */}
  <button
    type="button"
    onClick={() => onAction?.('pay')}
    className="
      w-full flex items-center justify-between
      rounded-2xl
      bg-white
      border border-slate-200
      px-4 py-4
      transition transition-colors duration-150
      hover:bg-blue-50
      active:bg-blue-100
      active:scale-[0.99]
    "
  >
    <div className="flex items-center gap-3">
      <div
        className="
           w-11 h-11 rounded-full
			bg-gradient-to-br from-[#2fbf71] via-[#2bb9ff] to-[#4fa3ff]
			flex items-center justify-center
			flex-shrink-0
			ring-1 ring-white/15
			transition
			active:scale-[0.98]
        "
      >
        <IpfsImg
          src={payIcon}
          alt="Pay"
          className="w-5 h-5 filter brightness-0 invert"
        />
      </div>

      <div className="text-left">
        <div className="text-[15px] font-semibold text-slate-900">
          Send
        </div>
        <div className="text-[12px] text-slate-500">
          To @BeamioTag or address
        </div>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-slate-400" />
  </button>



  {/* Request Link / QR */}
  <button
    type="button"
    onClick={() => onAction?.('request-link')}
    className="
      w-full flex items-center justify-between
      rounded-2xl
      bg-white
      border border-slate-200
      px-4 py-4
      transition transition-colors duration-150
      hover:bg-blue-50
      active:bg-blue-100
      active:scale-[0.99]
    "
  >
    <div className="flex items-center gap-3">
      <div
        className="
			w-11 h-11 rounded-full
			bg-gradient-to-br from-[#ffb56b] via-[#ff9f8f] to-[#ff8fb1]
			flex items-center justify-center
			flex-shrink-0
			ring-1 ring-white/15
			transition
			active:scale-[0.98]
        "
      >
        <IpfsImg
          src={rlIcon}
          alt="Request Link or QR"
          className="w-5 h-5 filter brightness-0 invert"
        />
      </div>

      <div className="text-left">
        <div className="text-[14px] font-semibold text-slate-900">
          Request (Link / QR)
        </div>
        <div className="text-[11px] text-slate-500">
          Get paid (Any / Fixed)
        </div>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-slate-400" />
  </button>

  {/* Cashcode */}
  <button
    type="button"
    onClick={() => onAction?.('cashcode')}
    className="
      w-full flex items-center justify-between
      rounded-2xl
      bg-white
      border border-slate-200
      px-4 py-4
      transition transition-colors duration-150
      hover:bg-blue-50
      active:bg-blue-100
      active:scale-[0.99]
    "
  >
    <div className="flex items-center gap-3">
      <div
        className="
          w-11 h-11 rounded-full
          bg-gradient-to-br from-[#2b6cff] via-[#6b4cff] to-[#ff4fa0]
          flex items-center justify-center
          flex-shrink-0
          ring-1 ring-white/15
          transition
          active:scale-[0.98]
        "
      >
        <IpfsImg
          src={cashcodeIcon}
          alt="Cashcode"
          className="w-5 h-5 filter brightness-0 invert"
        />
      </div>

      <div className="text-left">
        <div className="text-[15px] font-semibold text-slate-900">
          Cashcode
        </div>
        <div className="text-[12px] text-slate-500">
          Refunds • vouchers • gifts
        </div>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-slate-400" />
  </button>
  {/* Pay me QR */}
  {/* <button
    type="button"
    onClick={() => onAction?.('payme-qr')}
    className="
      w-full flex items-center justify-between
      rounded-2xl
      bg-white
      border border-slate-200
      px-4 py-4
      transition transition-colors duration-150
      hover:bg-blue-50
      active:bg-blue-100
      active:scale-[0.99]
    "
  >
    <div className="flex items-center gap-3">
      <div
        className="
          	w-11 h-11 rounded-full
			bg-gradient-to-br from-[#8b7bff] via-[#b07bff] to-[#d07bff]
			flex items-center justify-center
			flex-shrink-0
			ring-1 ring-white/15
			transition
			active:scale-[0.98]
        "
      >
        <IpfsImg
          src={pmIcon}
          alt="Pay me QR"
          className="w-5 h-5 filter brightness-0 invert"
        />
      </div>

      <div className="text-left">
        <div className="text-[14px] font-semibold text-slate-900">
          Pay me QR
        </div>
        <div className="text-[11px] text-slate-500">
          Create a QR to get paid
        </div>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-slate-400" />
  </button> */}
</div>
  )
}
