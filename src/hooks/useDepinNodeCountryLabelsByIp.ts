import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchDepinNodeCountryLabelByIp } from '@/services/validatorWalletNodeProfile'

/** 按 DePIN IP 批量解析 Guardian 链上 region → 国家名；失败保留上次可信值。 */
export function useDepinNodeCountryLabelsByIp(ips: string[]): {
	countryByIp: Record<string, string>
	loading: boolean
} {
	const normalizedIps = useMemo(() => {
		const seen = new Set<string>()
		const list: string[] = []
		for (const raw of ips) {
			const ip = String(raw ?? '').trim().toLowerCase()
			if (!ip || seen.has(ip)) continue
			seen.add(ip)
			list.push(ip)
		}
		return list
	}, [ips])

	const ipKey = normalizedIps.join('|')
	const [countryByIp, setCountryByIp] = useState<Record<string, string>>({})
	const [loading, setLoading] = useState(false)
	const lastTrustedRef = useRef<Record<string, string>>({})

	useEffect(() => {
		if (!ipKey) {
			setCountryByIp({})
			lastTrustedRef.current = {}
			setLoading(false)
			return
		}

		let cancelled = false
		setLoading(true)

		void (async () => {
			const next: Record<string, string> = { ...lastTrustedRef.current }
			for (const ip of normalizedIps) {
				if (cancelled) return
				const label = await fetchDepinNodeCountryLabelByIp(ip)
				if (label) next[ip] = label
			}
			if (cancelled) return
			lastTrustedRef.current = next
			setCountryByIp(next)
			setLoading(false)
		})()

		return () => {
			cancelled = true
		}
	}, [ipKey, normalizedIps])

	return { countryByIp, loading }
}
