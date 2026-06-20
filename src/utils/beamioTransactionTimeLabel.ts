/**
 * Transaction list / detail relative time — parity with iOS POSTransactionRowView.timeLine
 */
import { t, getCurrentBeamioUiLocale } from '@/locale/i18n'

export function formatBeamioTransactionTimeLabel(timestampMs: number): string {
	if (!timestampMs || !Number.isFinite(timestampMs)) return t('time.emDash')
	const d = new Date(timestampMs)
	if (!Number.isFinite(d.getTime())) return t('time.emDash')

	const diffSec = Date.now() / 1000 - timestampMs / 1000

	if (diffSec < 60 * 60) {
		const mins = Math.max(0, Math.floor(diffSec / 60))
		return t('time.minutesAgo', { count: mins })
	}
	if (diffSec < 24 * 60 * 60) {
		const hours = Math.floor(diffSec / 3600)
		return t('time.hoursAgo', { count: hours })
	}
	if (diffSec < 48 * 60 * 60) {
		return t('time.yesterday')
	}

	const locale = getCurrentBeamioUiLocale() === 'en' ? 'en-US' : 'zh-CN'
	const month = d.toLocaleDateString(locale, { month: 'short' })
	const day = d.getDate()
	const hh = String(d.getHours()).padStart(2, '0')
	const mm = String(d.getMinutes()).padStart(2, '0')
	return t('time.dateTime', { month, day, time: `${hh}:${mm}` })
}

/** @deprecated Prefer `formatBeamioTransactionTimeLabel` — kept for existing imports. */
export const formatRecentActivityItemTime = formatBeamioTransactionTimeLabel
