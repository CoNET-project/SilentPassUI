import { ethers } from 'ethers'

/** Legacy beamioConet (0xCE8e2Cda…) — not redeployed on CoNET 224422; Cashcode / link memo disabled. */
export const BEAMIO_CONET_CASHCODE_DEPRECATED = true

export type LegacyBeamioConetLinkMemo = {
	to: string
	amount: bigint
	node: string
}

export type LegacyBeamioConetCheckMemo = {
	payHash: string
	depositHash: string
	from: string
	node: string
	amount: bigint
	createTimestamp: bigint
}

const emptyLinkMemo = (): LegacyBeamioConetLinkMemo => ({
	to: ethers.ZeroAddress,
	amount: 0n,
	node: '',
})

const emptyCheckMemo = (): LegacyBeamioConetCheckMemo => ({
	payHash: ethers.ZeroHash,
	depositHash: ethers.ZeroHash,
	from: ethers.ZeroAddress,
	node: '',
	amount: 0n,
	createTimestamp: 0n,
})

/** @deprecated Use Beamio payment link / redeem APIs instead of on-chain beamioConet memos. */
export async function getDeprecatedBeamioConetLinkMemo(_code: string): Promise<LegacyBeamioConetLinkMemo> {
	return emptyLinkMemo()
}

/** @deprecated Cashcode on-chain validation removed with beamioConet retirement. */
export async function getDeprecatedBeamioConetCheckMemo(_secureCode: string): Promise<LegacyBeamioConetCheckMemo> {
	return emptyCheckMemo()
}

/** @deprecated Alias for legacy `beamioCoreConet.checkMemo`. */
export async function checkDeprecatedBeamioConetMemo(_hash: string): Promise<LegacyBeamioConetCheckMemo> {
	return emptyCheckMemo()
}
