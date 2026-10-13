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
	getBizWorkspaceRole,
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
		if (path === '/agent' || path === '/' || path === '/Onboarding') {
			setVisible(false)
			return
		}
		const eoa = profiles?.[0]?.keyID?.trim() || getCoNET_Data()?.profiles?.[0]?.keyID?.trim()
		if (!eoa || !ethers.isAddress(eoa)) {
			setVisible(false)
			return
		}
		const asAgent = loadAgentWorkspace(eoa)
		if (asAgent || getBizWorkspaceRole() === 'agent') {
			// Current session is the agent itself — no banner
			setVisible(false)
			return
		}
		const byTemp = findAgentWorkspaceByTempEoa(eoa)
		setVisible(!!byTemp && !!getSessionAgentAccessPassword())
	}, [location.pathname, profiles])

	const onReturn = useCallback(async () => {
		if (returning) return
		setReturning(true)
		try {
			const ok = await returnToAgentWorkspace(unlockDeps)
			if (ok) navigate('/agent')
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
