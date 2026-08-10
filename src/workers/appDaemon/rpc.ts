/**
 * Shared App Daemon JSON-RPC providers.
 * Prefer batched HTTP eth_call (batchMaxCount > 1); never force batchMaxCount: 1.
 */

import { ethers } from 'ethers'
import { APP_DAEMON_BASE_RPC, APP_DAEMON_CONET_RPC } from './protocol'

const BATCH_MAX = 100

let conetProvider: ethers.JsonRpcProvider | null = null
let baseProvider: ethers.JsonRpcProvider | null = null

export function getAppDaemonConetProvider(): ethers.JsonRpcProvider {
	if (!conetProvider) {
		conetProvider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
			staticNetwork: true,
			batchMaxCount: BATCH_MAX,
		})
	}
	return conetProvider
}

export function getAppDaemonBaseProvider(): ethers.JsonRpcProvider {
	if (!baseProvider) {
		baseProvider = new ethers.JsonRpcProvider(APP_DAEMON_BASE_RPC, 8453, {
			staticNetwork: true,
			batchMaxCount: BATCH_MAX,
		})
	}
	return baseProvider
}
