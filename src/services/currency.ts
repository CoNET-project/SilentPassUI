

export const CURRENCY_META: Record<
  ICurrency,
  { flag: string; symbol: string; label: string }
> = {
  USD: { flag: "🇺🇸", symbol: "$", label: "USD" },
  CAD: { flag: "🇨🇦", symbol: "$", label: "CAD" },
  EUR: { flag: "🇪🇺", symbol: "€", label: "EUR" },
  JPY: { flag: "🇯🇵", symbol: "¥", label: "JPY" },
  CNY: { flag: "🇨🇳", symbol: "¥", label: "CNY" },
  HKD: { flag: "🇭🇰", symbol: "$", label: "HKD" },
  TWD: { flag: "🇹🇼", symbol: "$", label: "TWD" },
  SGD: { flag: "🇸🇬", symbol: "$", label: "SGD" },
  USDC: {flag:"", symbol: "", label: ""}
};

export const fiatPrefix = (ccy: ICurrency) => {
	if (typeof ccy !== 'string') return ''
	if (ccy === "CAD") return "CA$"
	if (ccy === "USD") return "$"
	if (ccy === "EUR") return "€"
	if (ccy === "JPY") return "JP¥"
	if (ccy==='TWD') return "NT$"
	if (ccy==='CNY') return 'CN¥'
	if (ccy==='HKD') return 'HK$'
	if (ccy==='SGD') return 'SG$'

	
	return ''
  	// return CURRENCY_META[ccy].symbol
}

export const getDecimals = (c: ICurrency) => {
	const decimals =
		c === "TWD" || c === "JPY"
		? 0
		: c === "USDC"
		? 4
		: 2
	return decimals
}

export const formatAmount = (v: number, c: ICurrency) => {
	if (!isFinite(v)) return "0"

	const decimals = getDecimals(c)

	return v.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	})
}

function toMs(ts: number) {
	// 秒/毫秒兼容
	return ts < 10_000_000_000 ? ts * 1000 : ts
}


export const formatTimeDetail = (ts: number) => {
	const d = new Date(toMs(ts))
	if (isNaN(d.getTime())) return ""
	// 例：Dec 30, 2025 · 7:24 PM
	const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
	const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	return `${date} · ${time}`
}
