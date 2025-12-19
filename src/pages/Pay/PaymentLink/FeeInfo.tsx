import { useState, useRef, useEffect } from 'react';


import {
  ArrowLeft,
  Camera,
  Check,
  Search,
  ChevronRight,
  X,
  Copy,
  Info,
  ExternalLink,
} from "lucide-react"

type Props = {
	close: () => void
};


const FeeInfo = ({ close }: Props) => {
  const [cols, setCols] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);


  // 监听容器宽度变化，自适应列数
  useEffect(() => {
    const calculateCols = () => {
      if (!containerRef.current) return;

      const width = containerRef.current.offsetWidth;
      const itemWidth = 120; // 每个胶囊的估计宽度（包括间距）
      const newCols = Math.max(2, Math.floor(width / itemWidth));

      setCols(newCols);
    };

    calculateCols();

    const resizeObserver = new ResizeObserver(calculateCols);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
 <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Fees &amp; settlement
        </h2>
		<button
          type="button"
          onClick={close}
          className="
            inline-flex items-center justify-center
            w-10 h-10 rounded-full
            bg-white/60 border border-white/25
            backdrop-blur
            transition
            active:scale-[0.98]
          "
          aria-label="Close"
        >
          <X className="w-5 h-5 text-black/20" />
        </button>
      </div>

      {/* Cards */}
      <div className="mt-4 space-y-4">
        {/* Beamio fee */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-[18px] font-semibold text-slate-900">
            Beamio fee
          </div>
          <div className="mt-2 text-[16px] leading-relaxed text-slate-600">
            Beamio fee: 0.8% (min 0.02 USDC; max 2.00 USDC)
          </div>
        </div>

        {/* FX note */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-[18px] font-semibold text-slate-900">
            FX note
          </div>
          <div className="mt-2 text-[16px] leading-relaxed text-slate-600">
            Fiat-locked: final USDC amount, fee, and net receive are calculated
            when the payer pays, based on the live FX quote.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeInfo;