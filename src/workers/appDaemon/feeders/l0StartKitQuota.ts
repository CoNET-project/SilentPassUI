/**
 * L0 Start Kit quota — Worker RPC only (localStorage stays on main).
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC } from '../protocol'

const REGISTRY = '0xD6252Cbf266B80231397Ac2a4f25ed2d9b01DEE6'
const ROLE_L0 = 1
const ABI = [
	'function members(address) view returns (uint8 role, address parentAdmin, address parentL0, uint256 rebateBps, uint256 ratioBps, bool active)',
	'function merchantQuotas(address) view returns (uint256 starterKetRemaining, uint256 paidBunitRemaining, uint256 issuedCodeCount, uint256 claimedCodeCount)',
] as const

export type WorkerL0StartKitQuota = {
	eoa: string
	starterKetRemaining: string
	paidBunitRemaining: string
	issuedCodeCount: string
	claimedCodeCount: string
	fetchedAt: number
}

export type WorkerL0StartKitResult =
	| { ok: true; isL0: true; quota: WorkerL0StartKitQuota }
	| { ok: true; isL0: false }
	| { ok: false }

export async function fetchWorkerL0StartKitQuota(rawEoa: string): Promise<WorkerL0StartKitResult> {
	let eoa: string
	try {
		eoa = ethers.getAddress(rawEoa.trim())
	} catch {
		return { ok: false }
	}
	try {
		const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC, 224422, {
			staticNetwork: true,
			batchMaxCount: 1,
		})
		const registry = new ethers.Contract(REGISTRY, ABI, provider)
		const member = await registry.members(eoa)
		if (Number(member.role) !== ROLE_L0) {
			return { ok: true, isL0: false }
		}
		const q = await registry.merchantQuotas(eoa)
		return {
			ok: true,
			isL0: true,
			quota: {
				eoa,
				starterKetRemaining: q.starterKetRemaining.toString(),
				paidBunitRemaining: q.paidBunitRemaining.toString(),
				issuedCodeCount: q.issuedCodeCount.toString(),
				claimedCodeCount: q.claimedCodeCount.toString(),
				fetchedAt: Date.now(),
			},
		}
	} catch {
		return { ok: false }
	}
}
