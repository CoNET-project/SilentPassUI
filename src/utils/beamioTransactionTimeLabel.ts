/**
 * Transaction list / detail relative time — parity with iOS POSTransactionRowView.timeLine
 * (`ContentView.swift`, POSTransactionsScreen).
 *
 * Single source of truth for SilentPassUI Recent Activity and any transaction row subtitle time.
 */
export function formatBeamioTransactionTimeLabel(timestampMs: number): string {
	if (!timestampMs || !Number.isFinite(timestampMs)) return '—'
	const d = new Date(timestampMs)
	if (!Number.isFinite(d.getTime())) return '—'

	const diffSec = Date.now() / 1000 - timestampMs / 1000

	if (diffSec < 60 * 60) {
		const mins = Math.max(0, Math.floor(diffSec / 60))
		return `${mins}m ago`
	}
	if (diffSec < 24 * 60 * 60) {
		const hours = Math.floor(diffSec / 3600)
		return `${hours}h ago`
	}
	if (diffSec < 48 * 60 * 60) {
		return 'Yesterday'
	}

	const month = d.toLocaleDateString('en-US', { month: 'short' })
	const day = d.getDate()
	const hh = String(d.getHours()).padStart(2, '0')
	const mm = String(d.getMinutes()).padStart(2, '0')
	return `${month} ${day}, ${hh}:${mm}`
}

/** @deprecated Prefer `formatBeamioTransactionTimeLabel` — kept for existing imports. */
export const formatRecentActivityItemTime = formatBeamioTransactionTimeLabel
