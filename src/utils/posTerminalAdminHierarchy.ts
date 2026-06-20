/**
 * POS terminal admin tree: card owner (top-level admin) → POS subordinate admin.
 * See `.cursor/rules/beamio-pos-terminal-admin-hierarchy.mdc`.
 */
import { ethers } from 'ethers'
import { CONET_CARD_FACTORY } from '@/config/chainAddresses'
import {
	encodeAddAdminWithMintLimit,
	encodeRemoveAdmin,
	isCardAdmin,
	postCardAddAdmin,
	postCardAddAdminByAdmin,
	signExecuteForAdmin,
	signExecuteForOwner,
} from '../services/BeamioCard'
import { providerForBeamioUserCard } from './beamioUserCardChain'

const USER_CARD_ADMIN_READ_ABI = [
	'function owner() view returns (address)',
	'function adminParent(address) view returns (address)',
	'function isAdmin(address) view returns (bool)',
] as const

export type PosTerminalMigrationRow = {
	posEoa: string
	metadata: string
	mintLimitE6: string
}

export type RegisterPosUnderOwnerResult = {
	posEoa: string
	status: 'registered' | 'skipped' | 'reparented' | 'failed'
	reason?: string
	txHash?: string
}

async function waitForCardAdminLocal(cardAddress: string, adminEoa: string, maxMs = 90_000): Promise<boolean> {
	const deadline = Date.now() + maxMs
	while (Date.now() < deadline) {
		if (await isCardAdmin(cardAddress, adminEoa)) return true
		await new Promise((r) => setTimeout(r, 2000))
	}
	return false
}

/** Owner EOA must be top-level admin (adminParent==0) before POS can be added underneath. */
export async function ensureMerchantOwnerTopLevelAdmin(args: {
	privateKeyArmor: string
	cardAddress: string
	ownerEoa: string
	mintLimitPoints6: bigint
	metadata?: string
}): Promise<void> {
	const cardAddress = ethers.getAddress(args.cardAddress)
	const ownerNorm = ethers.getAddress(args.ownerEoa)
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, provider)
	const cardOwner = ethers.getAddress((await card.owner()) as string)
	if (cardOwner !== ownerNorm) {
		throw new Error(`Card owner is ${cardOwner}; expected merchant EOA ${ownerNorm}.`)
	}
	const isAdmin = await isCardAdmin(cardAddress, ownerNorm)
	const parent = isAdmin ? ethers.getAddress((await card.adminParent(ownerNorm)) as string) : ethers.ZeroAddress
	if (isAdmin && parent === ethers.ZeroAddress) return

	const metadata =
		args.metadata ??
		JSON.stringify({
			role: 'merchant',
			label: 'Program owner (top-level admin)',
		})
	const data = encodeAddAdminWithMintLimit(ownerNorm, 1, metadata, args.mintLimitPoints6)
	const deadline = Math.floor(Date.now() / 1000) + 15 * 60
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const ownerSignature = await signExecuteForOwner(args.privateKeyArmor, cardAddress, data, deadline, nonce, CONET_CARD_FACTORY)
	const res = await postCardAddAdmin({
		cardAddress,
		data,
		deadline,
		nonce,
		ownerSignature,
		adminEOA: ownerNorm,
	})
	if (!res.success) throw new Error(res.error ?? 'Failed to register merchant owner as top-level admin.')
	const ok = await waitForCardAdminLocal(cardAddress, ownerNorm)
	if (!ok) throw new Error('Merchant owner admin not confirmed on-chain yet.')
	const parentAfter = ethers.getAddress((await card.adminParent(ownerNorm)) as string)
	if (parentAfter !== ethers.ZeroAddress) {
		throw new Error(`Merchant owner admin parent must be zero; got ${parentAfter}.`)
	}
}

async function removePosIfWrongParent(args: {
	privateKeyArmor: string
	cardAddress: string
	ownerEoa: string
	posEoa: string
}): Promise<boolean> {
	const cardAddress = ethers.getAddress(args.cardAddress)
	const ownerNorm = ethers.getAddress(args.ownerEoa)
	const posNorm = ethers.getAddress(args.posEoa)
	const { provider } = await providerForBeamioUserCard(cardAddress)
	const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, provider)
	if (!(await card.isAdmin(posNorm))) return false
	const parent = ethers.getAddress((await card.adminParent(posNorm)) as string)
	if (parent === ownerNorm) return false
	const data = encodeRemoveAdmin(posNorm, 1, JSON.stringify({ source: 'posTerminalAdminHierarchy', action: 'reparent' }))
	const deadline = Math.floor(Date.now() / 1000) + 15 * 60
	const nonce = ethers.hexlify(ethers.randomBytes(32))
	const ownerSignature = await signExecuteForOwner(args.privateKeyArmor, cardAddress, data, deadline, nonce, CONET_CARD_FACTORY)
	const res = await postCardAddAdmin({
		cardAddress,
		data,
		deadline,
		nonce,
		ownerSignature,
		adminEOA: posNorm,
	})
	if (!res.success) throw new Error(res.error ?? `Failed to remove POS ${posNorm} from wrong parent ${parent}.`)
	await new Promise((r) => setTimeout(r, 4000))
	return true
}

/** Register one POS EOA as subordinate admin under merchant owner EOA (owner signs executeForAdmin). */
export async function registerPosTerminalUnderOwnerAdmin(args: {
	privateKeyArmor: string
	cardAddress: string
	ownerEoa: string
	posEoa: string
	metadata: string
	mintLimitPoints6: bigint
}): Promise<RegisterPosUnderOwnerResult> {
	const cardAddress = ethers.getAddress(args.cardAddress)
	const ownerNorm = ethers.getAddress(args.ownerEoa)
	const posNorm = ethers.getAddress(args.posEoa)
	const row: RegisterPosUnderOwnerResult = { posEoa: posNorm, status: 'failed' }
	try {
		const { provider } = await providerForBeamioUserCard(cardAddress)
		const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, provider)
		const codeAtPos = await provider.getCode(posNorm)
		if (codeAtPos && codeAtPos !== '0x') {
			throw new Error(`Terminal ${posNorm} is a contract; adminManager requires EOA.`)
		}
		if (await card.isAdmin(posNorm)) {
			const parent = ethers.getAddress((await card.adminParent(posNorm)) as string)
			if (parent === ownerNorm) {
				return { posEoa: posNorm, status: 'skipped', reason: 'Already subordinate admin under merchant owner.' }
			}
			const removed = await removePosIfWrongParent(args)
			if (removed) row.status = 'reparented'
		}
		const data = encodeAddAdminWithMintLimit(posNorm, 1, args.metadata, args.mintLimitPoints6)
		const deadline = Math.floor(Date.now() / 1000) + 15 * 60
		const nonce = ethers.hexlify(ethers.randomBytes(32))
		const adminSignature = await signExecuteForAdmin(args.privateKeyArmor, cardAddress, data, deadline, nonce)
		const res = await postCardAddAdminByAdmin({
			cardAddress,
			data,
			deadline,
			nonce,
			adminSignature,
			adminEOA: posNorm,
		})
		if (!res.success) throw new Error(res.error ?? 'cardAddAdminByAdmin failed')
		const ok = await waitForCardAdminLocal(cardAddress, posNorm, 60_000)
		if (!ok) throw new Error('POS admin not confirmed on-chain.')
		const parentAfter = ethers.getAddress((await card.adminParent(posNorm)) as string)
		if (parentAfter !== ownerNorm) {
			throw new Error(`POS parent is ${parentAfter}; expected merchant owner ${ownerNorm}.`)
		}
		return {
			posEoa: posNorm,
			status: row.status === 'reparented' ? 'reparented' : 'registered',
			txHash: res.hash,
		}
	} catch (e: unknown) {
		return { posEoa: posNorm, status: 'failed', reason: e instanceof Error ? e.message : String(e) }
	}
}

/** Batch register migration terminals under owner (client-side; owner signs). */
export async function registerMigrationTerminalsUnderOwnerAdmin(args: {
	privateKeyArmor: string
	cardAddress: string
	ownerEoa: string
	totalBalanceE6: string
	terminals: PosTerminalMigrationRow[]
}): Promise<{
	total: number
	registered: number
	skipped: number
	reparented: number
	failed: number
	rows: RegisterPosUnderOwnerResult[]
}> {
	const mintLimitFallback = BigInt(args.totalBalanceE6 || '0')
	await ensureMerchantOwnerTopLevelAdmin({
		privateKeyArmor: args.privateKeyArmor,
		cardAddress: args.cardAddress,
		ownerEoa: args.ownerEoa,
		mintLimitPoints6: mintLimitFallback > 0n ? mintLimitFallback : 550_000_000n,
	})
	const rows: RegisterPosUnderOwnerResult[] = []
	let registered = 0
	let skipped = 0
	let reparented = 0
	let failed = 0
	for (const t of args.terminals) {
		const oldLimit = BigInt(t.mintLimitE6 || '0')
		const mintLimit = oldLimit > 0n ? oldLimit : mintLimitFallback
		const result = await registerPosTerminalUnderOwnerAdmin({
			privateKeyArmor: args.privateKeyArmor,
			cardAddress: args.cardAddress,
			ownerEoa: args.ownerEoa,
			posEoa: t.posEoa,
			metadata: t.metadata,
			mintLimitPoints6: mintLimit,
		})
		rows.push(result)
		if (result.status === 'registered') registered += 1
		else if (result.status === 'skipped') skipped += 1
		else if (result.status === 'reparented') reparented += 1
		else failed += 1
	}
	return { total: args.terminals.length, registered, skipped, reparented, failed, rows }
}
