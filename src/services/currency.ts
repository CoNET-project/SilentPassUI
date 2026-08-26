

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

export const displayFiatPrefixFromCode = (raw: unknown, fallback: ICurrency = 'USD'): string => {
	const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
	if (code === 'USDC' || code === 'USD') return fiatPrefix('USD')
	if (code === 'CAD' || code === 'EUR' || code === 'JPY' || code === 'CNY' || code === 'HKD' || code === 'TWD' || code === 'SGD') {
		return fiatPrefix(code as ICurrency)
	}
	return fiatPrefix(fallback)
}

export const getDecimals = (c: ICurrency) => {
	const decimals =
		c === 'USDC' ? 2 :
		c === "TWD" || c === "JPY"
		? 0
		: 2
	return decimals
}

export const formatAmount = (
  v: number | string,
  c: ICurrency,
  fixed?: number
): string => {
  // 1️⃣ 统一转 number
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v)
        : NaN

  // 2️⃣ 非法值兜底
  if (!Number.isFinite(n)) return "0"

  // 3️⃣ decimals：fixed 优先，其次 currency
  const decimals =
    typeof fixed === "number"
      ? fixed
      : getDecimals(c)

  // 4️⃣ 本地化格式化
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/** Beamio 右对齐金额 protocol：非 USDC 时 "CURRENCY amount"，USDC 时 "amount USDC"，小数位沿用 getDecimals */
export const formatAmountWithCurrencyProtocol = (
  v: number | string,
  c: ICurrency
): string => {
  const amt = formatAmount(v, c)
  return c === 'USDC' ? `${amt} USDC` : `${c} ${amt}`
}

/** Token pts 人类可读：链上数位永远 10**6 */
export const formatPts = (ptsRaw: number | string | bigint): string =>
  formatAmount(Number(ptsRaw) / 1_000_000, "USDC", 6)

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

export const formatTimev2 = (ts: number) => {
	if (!ts) return "—"
	const d = new Date(ts)
	return d.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric"
	})
}

export const getBadgeClass = (type: HistoryFilter) => {
	switch (type) {
		case 'sent':
		return "bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200"

		case 'received':
		return "bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200"

		case 'pending':
		return "bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200"

		case 'completed':
		// 淡蓝色，对应 Completed tab 的默认态
		return "bg-sky-300/35 text-sky-800 dark:bg-sky-700/35 dark:text-sky-200"

		case 'reject':
		return "bg-rose-300/35 text-rose-700 dark:bg-rose-700/35 dark:text-rose-200"

		// request 专用：Withdraw（紫色）
		case 'paid':
		return "bg-fuchsia-300/35 text-fuchsia-800 dark:bg-fuchsia-700/35 dark:text-fuchsia-200"

		// cashcode 专用：Deposited（靛蓝）
		case 'deposited':
		return "bg-indigo-300/35 text-indigo-800 dark:bg-indigo-700/35 dark:text-indigo-200"

		// 一般不会有 'all' 出现在单条记录里，兜底给个中性灰
		case 'all':
		default:
		return "bg-slate-700/20 text-slate-800 dark:bg-white/10 dark:text-slate-200"
	}
}


export const statusStyleMap: Record<
	HistoryFilter,
	{
		container: string
		iconBg: string
		icon: string
		text: string
	}
	> = {
	sent: {
		container: "bg-rose-100",
		iconBg: "bg-rose-200",
		icon: "text-rose-700",
		text: "text-rose-600",
	},
	active: {
		container: "bg-emerald-100",
		iconBg: "bg-emerald-200",
		icon: "text-emerald-700",
		text: "text-emerald-600",
	},
	received: {
		container: "bg-emerald-100",
		iconBg: "bg-emerald-200",
		icon: "text-emerald-700",
		text: "text-emerald-600",
	},
	pending: {
		container: "bg-amber-100",
		iconBg: "bg-amber-200",
		icon: "text-amber-500",
		text: "text-amber-700",
	},
	payme: {
		container: "bg-fuchsia-100",
		iconBg: "bg-fuchsia-200",
		icon: "text-fuchsia-700",
		text: "text-fuchsia-800",
	},
	paid: {
		container: "bg-fuchsia-100",
		iconBg: "bg-fuchsia-200",
		icon: "text-fuchsia-700",
		text: "text-fuchsia-800",
	},
	completed: {
		container: "bg-sky-100",
		iconBg: "bg-sky-200",
		icon: "text-sky-700",
		text: "text-sky-800",
	},
	deposited: {
		container: "bg-indigo-100",
		iconBg: "bg-indigo-200",
		icon: "text-indigo-700",
		text: "text-indigo-800",
	},

	// 兜底（all / reject / 其他）
	all: {
		container: "bg-slate-100",
		iconBg: "bg-slate-200",
		icon: "text-slate-500",
		text: "text-slate-500",
	},
	reject: {
		container: "bg-slate-100",
		iconBg: "bg-slate-200",
		icon: "text-slate-500",
		text: "text-slate-500",
	},
}

// 根据「到账金额 received」反推 fee
export function calcFeeFromReceived(received: number) {
	if (!isFinite(received) || received <= 0) return 0

	// 1️⃣ 尝试比例区间（最常见）
	const baseByRatio = received / 0.992
	const feeByRatio = baseByRatio - received

	if (feeByRatio > 0.02 && feeByRatio < 2) {
		return Number(feeByRatio.toFixed(4))
	}

	// 2️⃣ 尝试最小 fee
	const baseMin = received + 0.02
	if (baseMin * 0.008 <= 0.02) {
		return 0.02
	}

	// 3️⃣ 尝试最大 fee
	const baseMax = received + 2
	if (baseMax * 0.008 >= 2) {
		return 2
	}

	// 理论上不会到这里
	return Number(feeByRatio.toFixed(4))
}

// 0.8% fee, min 0.02, max 2 USDC
export function calcFeeFromNumber(base: number) {
	if (!isFinite(base) || base <= 0) return 0;
	const raw = base * 0.008;
	const clamped = Math.min(Math.max(raw, 0.02), 2);
	return Number(clamped.toFixed(4));
}


export type ParsedNote = {
	noteText: string
	card?: IImageCard
	payme?: payMe
  }
  
  const isObj = (v: any): v is Record<string, any> => v && typeof v === "object"
  
  const pickCard = (raw: any): IImageCard | undefined => {
	if (!isObj(raw)) return
  
	// 兼容 { card: {...} } 或直接就是 card
	const c = isObj(raw.card) ? raw.card : raw
  
	// 以 image 作为 card 的强特征
	if (typeof c?.image === "string" && c.image.length > 0) return c as IImageCard
	return
  }
  
  const pickPayme = (raw: any): payMe | undefined => {
	if (!isObj(raw)) return
  
	// 兼容 { payme: {...} }（如果你未来会这样包）
	const p = isObj((raw as any).payme) ? (raw as any).payme : raw
  
	// payme 的弱特征：usdcAmount / currency / currencyAmount（按你项目里习惯）
	const hasUSDC = typeof (p as any).usdcAmount === "number" && isFinite((p as any).usdcAmount)
	const hasCurrency = typeof (p as any).currency === "string"
	const hasCurrencyAmount =
	  (typeof (p as any).currencyAmount === "number" && isFinite((p as any).currencyAmount)) ||
	  (typeof (p as any).currencyAmount === "string" && (p as any).currencyAmount.length > 0)
  
	if (hasUSDC || (hasCurrency && hasCurrencyAmount)) return p as payMe
	return
  }
  
  export function parseNodeEX(note?: string): ParsedNote {
	const nodeEX = String(note || "").split("\r\n")
	const noteText = nodeEX[0] || ""
  
	// 只允许最多两段 JSON（第二、第三段）
	const candidates = nodeEX.slice(1, 3)
  
	const parsed: any[] = []
	for (const s of candidates) {
	  if (!s) continue
	  try {
		const obj = JSON.parse(s)
		if (obj != null) parsed.push(obj)
	  } catch {}
	}
  
	let card: IImageCard | undefined
	let payme: payMe | undefined
  
	for (const obj of parsed) {
	  // 先看是不是 card（更强特征）
	  const c = pickCard(obj)
	  if (c && !card) {
		card = c
		continue
	  }
  
	  // 再看是不是 payme
	  const p = pickPayme(obj)
	  if (p && !payme) {
		payme = p
		continue
	  }
  
	  // 兜底：如果是 {card:...} 但 image 不在 card 里，仍可能是 payme 被误当 card 包装
	  // 例如你之前遇到的 (card as any).usdcAmount > 0
	  if (!payme && isObj(obj)) {
		const maybe = isObj(obj.card) ? obj.card : obj
		const p2 = pickPayme(maybe)
		if (p2) payme = p2
	  }
	}
  
	return { noteText, card, payme }
  }