/**
 * Minimal CoNET wallet balances for App Daemon Worker (no main-thread imports).
 */

import { ethers } from 'ethers'
import { APP_DAEMON_CONET_RPC, type AppDaemonConetBalances } from '../protocol'

const ERC20_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
const CONET_USDC = '0x5209865D404aA5646eDe5B91CD4218909eA72eDA'
const CONET_GB = '0xC3EF02DaE632b4C10abB66e07d92a387c10838D8'

function formatUnitsTrunc(raw: bigint, decimals: number, maxFrac = 4): string {
	const neg = raw < 0n
	const v = neg ? -raw : raw
	const base = 10n ** BigInt(decimals)
	const whole = v / base
	const frac = v % base
	const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '')
	const body = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
	return neg ? `-${body}` : body
}

export async function fetchWorkerConetBalances(
	owner: string,
): Promise<{ ok: true; balances: AppDaemonConetBalances } | { ok: false }> {
	try {
		if (!ethers.isAddress(owner)) return { ok: false }
		const provider = new ethers.JsonRpcProvider(APP_DAEMON_CONET_RPC)
		const checksum = ethers.getAddress(owner)
		const usdc = new ethers.Contract(CONET_USDC, ERC20_ABI, provider)
		const gb = new ethers.Contract(CONET_GB, ERC20_ABI, provider)
		const [usdcRaw, cnetRaw, gbRaw] = await Promise.all([
			usdc.balanceOf(checksum) as Promise<bigint>,
			provider.getBalance(checksum),
			gb.balanceOf(checksum) as Promise<bigint>,
		])
		return {
			ok: true,
			balances: {
				usdc: formatUnitsTrunc(usdcRaw, 6, 4),
				cnet: formatUnitsTrunc(cnetRaw, 18, 4),
				gb: formatUnitsTrunc(gbRaw, 9, 4),
			},
		}
	} catch {
		return { ok: false }
	}
}
