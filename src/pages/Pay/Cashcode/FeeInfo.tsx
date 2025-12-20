import { useState, useRef, useEffect } from 'react';
import Close from '@/components/button/CloseButton'

import {
  X,
} from "lucide-react"

type Props = {
	close: () => void
	isUSDCFixed: boolean
};


const FeeInfo = ({ close, isUSDCFixed }: Props) => {
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
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 text-black/50">
          Fees
        </h2>
		<Close onClick={close} />
      </div>

      {/* Cards */}
		<div className="mt-4 space-y-4 ">

			{/* Beamio fee */}
			<div className="rounded-3xl border border-slate-200 p-5">
				<div className="text-[18px] font-semibold text-slate-900 text-black/50">
					Beamio fee
				</div>
				<div className="mt-2 text-[16px] leading-relaxed text-slate-600 text-black/50">
					0.8% (min 0.02 USDC; max 2.00 USDC)
				</div>
			</div>

			{/* Settlement note */}
			<div className="rounded-3xl border border-slate-200 p-5 ">
				<div className="text-[18px] font-semibold text-slate-900 text-black/50">
					Settlement
					
				</div>
				<div className="mt-2 text-[16px] leading-relaxed text-slate-600 text-black/50">
					Beamio settles in USDC only. If you enter local currency, we convert at the live quote and lock the USDC value.
				</div>
			</div>

			{/* Minimum note */}
			<div className="rounded-3xl border border-slate-200 p-5">
				<div className="text-[18px] font-semibold text-slate-900 text-black/50">
					Minimum
					
				</div>
				<div className="mt-2 text-[16px] leading-relaxed text-slate-600 text-black/50">
					Cashcode value must be greater than 0.10 USDC.
				</div>
			</div>
		</div>
    </div>
  );
};

export default FeeInfo;