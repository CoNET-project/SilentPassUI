/** Overview dashboard copy — internal time-filter values stay English/中文 literal for logic. */

export type OverviewTimeFilterInternal =
  | '今天'
  | 'This Week'
  | 'This Month'
  | 'This Quarter'
  | 'This Year'

export type OverviewReloadStatus = 'Quiet' | 'Active' | 'Accelerating'

type Translate = (key: string, options?: Record<string, unknown>) => string

export function overviewTimeFilterLabel(
  tf: OverviewTimeFilterInternal | string,
  tu: Translate,
  dateString?: string,
): string {
  switch (tf) {
    case '今天':
      return dateString
        ? tu('overview_filter_today_with_date', { date: dateString })
        : tu('overview_filter_today')
    case 'This Week':
      return tu('overview_filter_this_week')
    case 'This Month':
      return tu('overview_filter_this_month')
    case 'This Quarter':
      return tu('overview_filter_this_quarter')
    case 'This Year':
      return tu('overview_filter_this_year')
    default:
      return String(tf)
  }
}

export function overviewPeriodActivityTitle(tf: OverviewTimeFilterInternal | string, tu: Translate): string {
  return tu('overview_period_activity', { period: overviewTimeFilterLabel(tf, tu) })
}

export function overviewReloadStatusLabel(status: OverviewReloadStatus, tu: Translate): string {
  switch (status) {
    case 'Active':
      return tu('overview_reload_active')
    case 'Accelerating':
      return tu('overview_reload_accelerating')
    case 'Quiet':
    default:
      return tu('overview_reload_quiet')
  }
}

export function overviewReloadAvgGapDisplay(label: string, tu: Translate): string {
  if (label === '—') return tu('time.emDash')
  if (label === '<1 min') return tu('overview_avg_gap_under_min')
  const minMatch = /^(\d+) min$/.exec(label)
  if (minMatch) return tu('overview_avg_gap_minutes', { count: minMatch[1] })
  const hourMatch = /^([\d.]+) h$/.exec(label)
  if (hourMatch) return tu('overview_avg_gap_hours', { hours: hourMatch[1] })
  const dayMatch = /^(\d+) d$/.exec(label)
  if (dayMatch) return tu('overview_avg_gap_days', { count: dayMatch[1] })
  return label
}

export function overviewActivationCountLabel(count: number, tu: Translate): string {
  return count === 1
    ? tu('overview_activation_one', { count: count.toLocaleString() })
    : tu('overview_activation_many', { count: count.toLocaleString() })
}

export function overviewTerminalsLinkedSummary(count: number, tu: Translate): string {
  if (count === 1) return tu('overview_terminals_one')
  return tu('overview_terminals_many', { count: count.toLocaleString() })
}

export function overviewReloadBarTooltip(
  tu: Translate,
  count: number,
  slot: number,
  totalSlots: number,
): string {
  return tu('overview_bar_topup_tooltip', {
    count,
    slot,
    total: totalSlots,
  })
}
