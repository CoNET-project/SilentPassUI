import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ethers } from 'ethers'
import { useTu } from '@/locale/beamioLocale'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useUnlockMerchantWorkspaceDeps } from '@/hooks/useUnlockMerchantWorkspaceDeps'
import { getCoNET_Data } from '@/utils/globals'
import {
	findAgentWorkspaceByTempEoa,
	loadAgentWorkspace,
} from '@/utils/agentWorkspaceLocal'
import { returnToAgentWorkspace } from '@/utils/agentTempEoaOps'
import { getSessionAgentAccessPassword } from '@/utils/agentSessionSecrets'

/**
 * Shown while an agent is inside Merchant OS under a temp EOA session.
 * Returns to the agent workspace when clicked.
 */
export default function AgentTempSessionBanner() {
	const { tu } = useTu()
	const navigate = useNavigate()
	const location = useLocation()
	const { profiles } = useDaemonContext()
	const unlockDeps = useUnlockMerchantWorkspaceDeps()
	const [visible, setVisible] = useState(false)
	const [returning, setReturning] = useState(false)

	useEffect(() => {
		const path = location.pathname || ''
		if (
			path === '/agent'
			|| path === '/agent/merchant-onboarding'
			|| path === '/'
			|| path === '/Onboarding'
		) {
			setVisible(false)
			return
		}
		const eoa = profiles?.[0]?.keyID?.trim() || getCoNET_Data()?.profiles?.[0]?.keyID?.trim()
		if (!eoa || !ethers.isAddress(eoa)) {
			setVisible(false)
			return
		}
		const addr = ethers.getAddress(eoa)
		// Prefer temp ownership — a polluted workspace keyed by the temp EOA must not hide the banner.
		const byTemp = findAgentWorkspaceByTempEoa(addr)
		if (byTemp) {
			setVisible(true)
			return
		}
		const direct = loadAgentWorkspace(addr)
		if (direct && direct.agentEoa.toLowerCase() === addr.toLowerCase()) {
			setVisible(false)
			return
		}
		setVisible(false)
	}, [location.pathname, profiles])

	const onReturn = useCallback(async () => {
		if (returning) return
		setReturning(true)
		try {
			const ok = await returnToAgentWorkspace(unlockDeps)
			if (ok) {
				navigate('/agent', { replace: true })
				return
			}
			// Still leave Merchant OS so the agent dashboard can show password recovery.
			navigate('/agent', { replace: true })
		} finally {
			setReturning(false)
		}
	}, [returning, unlockDeps, navigate])

	if (!visible) return null

	return (
		<div
			className="pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-3"
			style={{ top: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
		>
			<button
				type="button"
				onClick={() => void onReturn()}
				disabled={returning}
				aria-busy={returning}
				className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#eadcf7] bg-[#8d3a8b] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#8d3a8b]/35 disabled:opacity-70"
			>
				{returning ? (
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
				) : (
					<ArrowLeft className="h-4 w-4" aria-hidden />
				)}
				{returning ? tu('agent_returning') : tu('agent_return_to_workspace')}
			</button>
		</div>
	)
}
