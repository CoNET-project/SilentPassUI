import { useState, useRef, useEffect } from 'react';
type Props = {
  currentCurrency: ICurrency;
  setCurrentCurrency: (val: ICurrency) => void;
};

type CurrencyItem = {
  c: ICurrency;
  flag: string;
  sym: string;
};

const CurrencyPicker = ({ setCurrentCurrency, currentCurrency }: Props) => {
  const [cols, setCols] = useState(3);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const allCurrencies: CurrencyItem[] = [
    { c: "USD", flag: "🇺🇸", sym: "$" },
    { c: "CAD", flag: "🇨🇦", sym: "$" },
    { c: "EUR", flag: "🇪🇺", sym: "€" },
    { c: "JPY", flag: "🇯🇵", sym: "¥" },
    { c: "CNY", flag: "🇨🇳", sym: "¥" },
    { c: "HKD", flag: "🇭🇰", sym: "$" },
    { c: "TWD", flag: "🇹🇼", sym: "NT$" },
    { c: "SGD", flag: "🇸🇬", sym: "$" },
  ];

  // 当前选中的项永远放在首位
  const currencies: CurrencyItem[] = [
    allCurrencies.find(c => c.c === currentCurrency)!,
    ...allCurrencies.filter(c => c.c !== currentCurrency)
  ];

  const pickCurrency = (currency: ICurrency) => {
    setCurrentCurrency(currency);
  };

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
    <div className=" ">
      <div ref={containerRef} className="max-w-4xl">

        {/* 自适应网格 */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {currencies.map((item, idx) => (
            <button
				key={item.c}
				ref={(el) => {
					optionRefs.current[idx] = el
				}}
				onClick={() => pickCurrency(item.c)}
				className={`
					w-full
					inline-flex items-center justify-center gap-2
					h-10 px-3
					rounded-full border-2
					bg-transparent
					transition-all duration-150
					active:scale-[0.98]
					focus:outline-none focus:ring-2 focus:ring-sky-300
					whitespace-nowrap
					${
						item.c === currentCurrency
							? "border-sky-400 dark:border-sky-500 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
							: "border-slate-300/70 dark:border-slate-600/60 hover:border-slate-400 dark:hover:border-slate-500"
					}
				`}
			>
				{/* Flag */}
				<span className="flex-none text-[18px] leading-none">
					{item.flag}
				</span>

				{/* Currency code */}
				<span className="flex-none text-xs font-bold text-slate-700 dark:text-slate-200">
					{item.c}
				</span>

				{/* Symbol */}
				<span className="flex-none text-sm font-medium text-slate-600 dark:text-slate-300">
					{item.sym}
				</span>
			</button>

          ))}
        </div>
      </div>
    </div>
  );
};

export default CurrencyPicker;