export type HistoryFilter = 'all' | 'send' | 'receive' | 'pending'

type HistoryFilterTabsProps = {
	active: HistoryFilter
	onChange: (value: HistoryFilter) => void

	// 新增：
	loading?: boolean              // 是否在 loading
	loadingFilter?: HistoryFilter | null  // 哪个 tab 在 loading
}

export function HistoryFilterTabs({
	active,
	onChange,
	loading = false,
	loadingFilter = null,
}: HistoryFilterTabsProps) {
	const baseBtn =
		'px-2 py-1 rounded-full font-medium text-[10px] backdrop-blur-md border border-white/15 transition disabled:opacity-45 disabled:cursor-default'

	const getBtnClass = (key: HistoryFilter) => {
		const isActive = active === key
		const isLoading = loading && loadingFilter === key

		if (key === 'all') {
		return [
			baseBtn,
			isActive || isLoading
			? 'bg-slate-900/90 text-white dark:bg-white/15 dark:text-white'
			: 'bg-slate-900/10 text-slate-700 dark:bg-white/5 dark:text-slate-200',
		].join(' ')
		}

		if (key === 'send') {
		return [
			baseBtn,
			isActive || isLoading
			? 'bg-slate-400/70 text-slate-900 dark:bg-slate-500/60 dark:text-white'
			: 'bg-slate-300/35 text-slate-700 dark:bg-slate-700/35 dark:text-slate-200',
		].join(' ')
		}

		if (key === 'receive') {
		return [
			baseBtn,
			isActive || isLoading
			? 'bg-emerald-300/80 text-emerald-900 dark:bg-emerald-500/70 dark:text-emerald-50'
			: 'bg-emerald-300/35 text-emerald-700 dark:bg-emerald-700/35 dark:text-emerald-200',
		].join(' ')
		}

		// pending
		return [
		baseBtn,
		isActive || isLoading
			? 'bg-amber-200/80 text-amber-900 dark:bg-amber-400/70 dark:text-amber-950'
			: 'bg-amber-200/40 text-amber-700 dark:bg-amber-700/35 dark:text-amber-200',
		].join(' ')
	}

	const renderLabel = (key: HistoryFilter) => {
		const isLoading = loading && loadingFilter === key
		const label =
		key === 'all'
			? 'All'
			: key === 'send'
			? 'Send'
			: key === 'receive'
			? 'Receive'
			: 'Pending'

		if (!isLoading) return label

		return (
		<span className="inline-flex items-center gap-1">
			<span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
			{label}
		</span>
		)
	}

	const handleClick = (key: HistoryFilter) => {
		// 如果当前是 loading，直接忽略点击
		if (loading) return
		onChange(key)
	}

	const isDisabled = (key: HistoryFilter) => {
		const isLoadingThis = loading && loadingFilter === key
		// loading 时，只有正在 loading 的按钮可点（某些场景你也可以让它也 disabled）
		return loading && !isLoadingThis
	}

	return (
		<div className="mb-5 flex items-center justify-end text-[10px]">
		<div className="flex items-center gap-1">
			<button
			className={getBtnClass('all')}
			disabled={isDisabled('all')}
			onClick={() => handleClick('all')}
			>
			{renderLabel('all')}
			</button>

			<button
			className={getBtnClass('send')}
			disabled={isDisabled('send')}
			onClick={() => handleClick('send')}
			>
			{renderLabel('send')}
			</button>

			<button
			className={getBtnClass('receive')}
			disabled={isDisabled('receive')}
			onClick={() => handleClick('receive')}
			>
			{renderLabel('receive')}
			</button>

			<button
			className={getBtnClass('pending')}
			disabled={isDisabled('pending')}
			onClick={() => handleClick('pending')}
			>
			{renderLabel('pending')}
			</button>
		</div>
		</div>
	)
}