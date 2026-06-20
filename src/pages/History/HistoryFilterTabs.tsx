import { tu } from '@/locale/beamioLocale'


type Mode = 'pay' | 'request' | 'cashcode'

type HistoryFilterTabsProps = {
	active: HistoryFilter
	onChange: (value: HistoryFilter) => void
	loading?: boolean
	loadingFilter?: HistoryFilter | null
	mode: Mode
}

// --- All moved to last position ---
const TABS_BY_MODE: Record<Mode, HistoryFilter[]> = {
	pay: ['sent', 'received', 'all'],
	request: [],
	cashcode: ['pending', 'completed', 'all'],
}

export function HistoryFilterTabs({
  active,
  onChange,
  loading = false,
  loadingFilter = null,
  mode,
}: HistoryFilterTabsProps) {
  const baseBtn =
    'px-2 py-1 rounded-full font-medium text-[10px] backdrop-blur-md border border-white/15 transition disabled:opacity-45 disabled:cursor-default'

  const getBtnClass = (key: HistoryFilter) => {
    const isActive = active === key
    const isLoading = loading && loadingFilter === key

    // --- NEW: All 的新颜色 ---
    if (key === 'all') {
      return [
        baseBtn,
        isActive || isLoading
          ? // Active
            'bg-slate-800/85 text-white dark:bg-white/15 dark:text-white'
          : // Inactive：比 send 深、比现在 all 浅
            'bg-slate-700/20 text-slate-800 dark:bg-white/10 dark:text-slate-200',
      ].join(' ')
    }

	 if (key === 'payme') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-slate-400/70 text-slate-900 dark:bg-slate-500/60 dark:text-white'
          : 'bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200',
      ].join(' ')
    }

    if (key === 'sent') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-slate-400/70 text-slate-900 dark:bg-slate-500/60 dark:text-white'
          : 'bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200',
      ].join(' ')
    }

	if (key === 'active') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-emerald-300/80 text-emerald-900 dark:bg-emerald-500/70 dark:text-emerald-50'
          : 'bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200',
      ].join(' ')
    }

    if (key === 'received') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-emerald-300/80 text-emerald-900 dark:bg-emerald-500/70 dark:text-emerald-50'
          : 'bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200',
      ].join(' ')
    }

    if (key === 'pending') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-400/70 dark:text-amber-950'
          : 'bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200',
      ].join(' ')
    }

    if (key === 'completed') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-sky-300/80 text-sky-900 dark:bg-sky-500/70 dark:text-sky-50'
          : 'bg-sky-300/35 text-sky-800 dark:bg-sky-700/35 dark:text-sky-200',
      ].join(' ')
    }

    if (key === 'paid') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-fuchsia-300/80 text-fuchsia-900 dark:bg-fuchsia-500/70 dark:text-fuchsia-50'
          : 'bg-fuchsia-300/35 text-fuchsia-800 dark:bg-fuchsia-700/35 dark:text-fuchsia-200',
      ].join(' ')
    }

    if (key === 'deposited') {
      return [
        baseBtn,
        isActive || isLoading
          ? 'bg-indigo-300/80 text-indigo-900 dark:bg-indigo-500/70 dark:text-indigo-50'
          : 'bg-indigo-300/35 text-indigo-800 dark:bg-indigo-700/35 dark:text-indigo-200',
      ].join(' ')
    }

    return [
      baseBtn,
      isActive || isLoading
        ? 'bg-rose-300/80 text-rose-900 dark:bg-rose-500/70 dark:text-rose-50'
        : 'bg-rose-300/35 text-rose-700 dark:bg-rose-700/35 dark:text-rose-200',
    ].join(' ')
  }

  const renderLabel = (key: HistoryFilter) => {
    const isLoading = loading && loadingFilter === key

    const label =
      key === 'sent'
        ? 'Sent'
        : key === 'received'
        ? 'Receive'
        : key === 'pending'
        ? tu('pending')
        : key === 'completed'
        ? 'Completed'
        : key === 'reject'
        ? 'Reject'
        : key === 'paid'
        ? 'Paid'
        : key === 'deposited'
        ? 'Deposited'
		: key === 'payme' ? 'Payme'
		: key === 'active' ? 'Active'
        : 'All'

    if (!isLoading) return label

    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
        {label}
      </span>
    )
  }

  const handleClick = (key: HistoryFilter) => {
    if (loading) return
    onChange(key)
  }

  const isDisabled = (key: HistoryFilter) => {
    const isLoadingThis = loading && loadingFilter === key
    return loading && !isLoadingThis
  }

  const tabs = TABS_BY_MODE[mode] ?? TABS_BY_MODE.pay

  return (
    <div className="mb-5 flex items-center justify-end text-[10px]">
      <div className="flex items-center gap-1">
        {tabs.map(key => (
          <button
            key={key}
            className={getBtnClass(key)}
            disabled={isDisabled(key)}
            onClick={() => handleClick(key)}
          >
            {renderLabel(key)}
          </button>
        ))}
      </div>
    </div>
  )
}
