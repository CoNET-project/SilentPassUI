import { useCallback, useEffect, useState } from 'react'
import {
	fetchReferralRegistryRole,
	type ReferralRegistryRoleResult,
	type ReferralRegistryRoleSnapshot,
} from '@/services/referralRegistryRole'

export function useReferralRegistryRole(eoa: string) {
	const [snapshot, setSnapshot] = useState<ReferralRegistryRoleSnapshot | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (!eoa.trim()) {
			setSnapshot(null)
			setError(null)
			return
		}
		setLoading(true)
		const result: ReferralRegistryRoleResult = await fetchReferralRegistryRole(eoa, { force: true })
		if (result.ok) {
			setSnapshot(result.snapshot)
			setError(null)
		} else {
			setError(result.error)
		}
		setLoading(false)
	}, [eoa])

	useEffect(() => {
		let cancelled = false
		setSnapshot(null)
		if (!eoa.trim()) {
			setError(null)
			return
		}
		setLoading(true)
		void fetchReferralRegistryRole(eoa).then((result) => {
			if (cancelled) return
			if (result.ok) {
				setSnapshot(result.snapshot)
				setError(null)
			} else {
				setError(result.error)
			}
			setLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [eoa])

	const isPrivileged = snapshot?.isAdmin === true || snapshot?.role === 'l0' || snapshot?.role === 'l1'
	return { snapshot, loading, error, isPrivileged, refresh }
}
