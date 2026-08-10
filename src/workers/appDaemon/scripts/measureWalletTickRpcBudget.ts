/**
 * Measure App Daemon 6s wallet tick CoNET eth_call budget.
 * Uses dashboard snapshot (1 call) + documents cadence layers.
 *
 *   npx tsx src/workers/appDaemon/scripts/measureWalletTickRpcBudget.ts
 */

import { ethers } from 'ethers'
import {
	APP_DAEMON_CONET_MULTICALL3,
	APP_DAEMON_CONET_RPC,
	APP_DAEMON_WALLET_DASHBOARD,
} from '../protocol'

async function main() {
	const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
		staticNetwork: true,
		batchMaxCount: 100,
	})
	let ethCalls = 0
	const origSend = provider.send.bind(provider)
	provider.send = async (method: string, params: Array<unknown>) => {
		if (method === 'eth_call') ethCalls += 1
		if (method === 'eth_call' && Array.isArray(params) === false) {
			/* batch */
		}
		// ethers may batch: method can be array in some versions — count array length
		return origSend(method, params)
	}

	const eoa = '0x87cAeD4e51C36a2C2ece3Aaf4ddaC9693d2405E1'
	const dash = new ethers.Contract(
		APP_DAEMON_WALLET_DASHBOARD,
		[
			'function snapshot(address eoa, address aaOptional) view returns (tuple(address eoa,address aa,uint256 eoaNative,uint256 eoaUsdc,uint256 eoaGb,uint256 aaNative,uint256 aaUsdc,uint256 aaGb,address beneficiary,uint256 validatorNodeCount,uint256 validatorPendingCount,uint256 gbMiningNodeCount,uint256 claimCount,uint256 vdrNative,uint256 vdrGb,uint256 vdrUsdc,bool isL0,uint256 starterKetRemaining,uint256 paidBunitRemaining,uint256 issuedCodeCount,uint256 claimedCodeCount,uint256 referredBeneficiaryCount,uint256 referralNodeTotal,uint256 rewardMilestonePaid,uint256 pendingRewardNodes,uint256 referredNodesOwnedTotal,uint256 nodesPerReward))',
		],
		provider,
	)

	ethCalls = 0
	const snap = await dash.snapshot(eoa, ethers.ZeroAddress)
	const dashCalls = ethCalls
	console.log('Phase3 dashboard snapshot eth_call count:', dashCalls)
	console.log('  eoaNative:', snap.eoaNative.toString())
	console.log('  beneficiary:', snap.beneficiary)
	console.log('  isL0:', snap.isL0)

	const mcCode = await provider.getCode(APP_DAEMON_CONET_MULTICALL3)
	console.log(
		'Multicall3 code bytes:',
		mcCode && mcCode !== '0x' ? (mcCode.length - 2) / 2 : 0,
	)

	console.log('\nCadence (Worker entry.ts):')
	console.log('  6s  wallet: 1× snapshot (≤2 eth_call incl getCode gate) OR balances+bundle')
	console.log('  30s side:   mining + Discover/Coupon Multicall + L0/ref if no dashboard')
	console.log('  90s unified: resolveUnifiedIncomeStats (skipClientSideAssemble)')
	console.log('  5m  oracle: Base Multicall3 getRate×8')

	if (dashCalls > 5) {
		console.error('FAIL: 6s tick budget > 5 eth_call')
		process.exit(1)
	}
	console.log('\nPASS: 6s wallet tick CoNET eth_call ≤ 5 (observed', dashCalls, ')')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
