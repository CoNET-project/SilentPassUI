import { useMemo } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import type { UnlockMerchantWorkspaceDeps } from '@/utils/unlockMerchantWorkspaceSession'

/** Build unlock deps from DaemonProvider for agent↔temp session switches. */
export function useUnlockMerchantWorkspaceDeps(): UnlockMerchantWorkspaceDeps {
	const {
		setProfiles,
		setaAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
	} = useDaemonContext()

	return useMemo(
		() => ({
			setProfiles,
			setAllNodes: setaAllNodes,
			setGossip,
			gossip: !!gossip,
			setBeamio: (val) => setBeamio(val),
			setCharts,
			setMyAddress,
		}),
		[setProfiles, setaAllNodes, setGossip, gossip, setBeamio, setCharts, setMyAddress],
	)
}
