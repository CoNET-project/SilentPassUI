/**
 * One-shot init for EOA 0x3da785…: airdrop merchant card #0 (program points)
 * on 0x6e600D… to LongDhang #0 holder AAs (table balances), excluding the
 * 990.291800 holder (AA 0x9Ac314… / EOA 0xa2d21f…).
 *
 * Mint path: client-encoded mintPointsByAdmin(aa, points6) → EIP-712
 * executeForAdmin → POST /api/nfcTopup. Idempotent via on-chain balanceOf + LS.
 */
import { ethers } from 'ethers'
import { beamioApi } from '@/utils/constants'
import {
	eip712ChainIdForBeamioUserCard,
	providerForBeamioUserCard,
} from '@/utils/beamioUserCardChain'
import { getCardFactoryGatewayForEip712, signExecuteForAdmin } from '@/services/BeamioCard'
import { getSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'

export const ADMIN_CARD0_AIRDROP_EOA = '0x3da785f046c489a2cd8cbcc57c131b62fe44a406'
export const ADMIN_CARD0_AIRDROP_CARD = '0x6e600DfaEa5eD006A97aF2AD080518c1d06C0A74'

/** Excluded LongDhang row #1 (do not airdrop). */
export const ADMIN_CARD0_AIRDROP_EXCLUDE_AA = '0x9Ac314E01807aB8B1504a912D7709e8267Ca00dC'
export const ADMIN_CARD0_AIRDROP_EXCLUDE_EOA = '0xa2d21fbd33f7d754d8d7a53fe2b4e5c39a008a1f'

const POINTS_TOKEN_ID = 0n
const DEADLINE_SEC = 3600
const LS_KEY_PREFIX = 'eoa:'
const LS_KEY_SUFFIX = ':biz:admin-card0-airdrop-longdhang:v1'

const MINT_IFACE = new ethers.Interface([
	'function mintPointsByAdmin(address user, uint256 points6)',
])

const ERC1155_BALANCE_ABI = [
	'function balanceOf(address account, uint256 id) view returns (uint256)',
] as const

/** LongDhang #0 holders → target AA + exact E6 points (human × 1e6). Row #1 excluded. */
export const ADMIN_CARD0_AIRDROP_RECIPIENTS: ReadonlyArray<{
	aa: string
	eoaOwner: string
	points6: bigint
	ptsHuman: string
}> = [
	{
		aa: '0x68FCA7dBC7aE305CB9fE5461D74B3E6296dC947b',
		eoaOwner: '0xf5fb3a36ab4d93d9cc5fd803e68298f3c5c3a015',
		points6: 200_000_000n,
		ptsHuman: '200.000000',
	},
	{
		aa: '0xf13Cfb9694C8aBd8F9c0922e09feb7fcCcDe02ae',
		eoaOwner: '0x3a50de8bbd17e51bdd373a53171ef061a57b204f',
		points6: 144_352_000n,
		ptsHuman: '144.352000',
	},
	{
		aa: '0xaA7E2489c73BA28B6a459dE3204297Aadec06143',
		eoaOwner: '0x2eea19340e371cc7cd6e922b10ed7b2bcef1ed25',
		points6: 111_664_200n,
		ptsHuman: '111.664200',
	},
	{
		aa: '0xb5efB0F159094dB8c6f4c23901C31AE34850dDf6',
		eoaOwner: '0xae3e24d54fc149776dae1f8076cf4ad445bc62c8',
		points6: 110_000_000n,
		ptsHuman: '110.000000',
	},
	{
		aa: '0x12fE0a8bfe1C3D1A4e159Ef2C33FA05ac81B7A73',
		eoaOwner: '0xcd87505cdd18fb542c8d8797369611070e745ec1',
		points6: 110_000_000n,
		ptsHuman: '110.000000',
	},
	{
		aa: '0xfeb96Dec9A76fc5245610a490dF64fc5AA5B8E7d',
		eoaOwner: '0xf6687c881dba9c6f54555e9c145b9b56cf9c10c0',
		points6: 44_972_000n,
		ptsHuman: '44.972000',
	},
	{
		aa: '0xd9E7967487Ce73415876a540aD893c5fF3A23Ba3',
		eoaOwner: '0xce2b523e8b0531112b27b7a44cc3890dbf710725',
		points6: 42_681_500n,
		ptsHuman: '42.681500',
	},
	{
		aa: '0x3F38F68Bf03aF3C1d7bC67893DeA172574B36EAC',
		eoaOwner: '0x82dadaec25bebb58d6fad2b91f394ad10a9b0ee1',
		points6: 9_999_001n,
		ptsHuman: '9.999001',
	},
	{
		aa: '0xAc70cF11eeb967f4E262b2EEE581928846b213cf',
		eoaOwner: '0xa9139eec0aed274534d48161d6085adbbbffa380',
		points6: 1_658_500n,
		ptsHuman: '1.658500',
	},
]

type AirdropRowResult = {
	aa: string
	points6: string
	status: 'minted' | 'skipped' | 'error'
	txHash?: string
	error?: string
	balanceBefore?: string
}

type AirdropLsState = {
	completedAt?: number
	results?: AirdropRowResult[]
}

let inFlight: Promise<void> | null = null

function lsKey(eoaLower: string): string {
	return `${LS_KEY_PREFIX}${eoaLower}${LS_KEY_SUFFIX}`
}

function loadLs(eoaLower: string): AirdropLsState | null {
	try {
		const raw = localStorage.getItem(lsKey(eoaLower))
		if (!raw) return null
		const parsed = JSON.parse(raw) as AirdropLsState
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}

function saveLs(eoaLower: string, state: AirdropLsState): void {
	try {
		localStorage.setItem(lsKey(eoaLower), JSON.stringify(state))
	} catch {
		/* quota / private mode */
	}
}

function normalizeEoa(raw: string | null | undefined): string | null {
	const t = raw?.trim()
	if (!t || !ethers.isAddress(t)) return null
	return ethers.getAddress(t)
}

async function postNfcTopupMint(params: {
	cardAddr: string
	data: string
	deadline: number
	nonce: string
	adminSignature: string
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
	const res = await fetch(`${beamioApi}/api/nfcTopup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cardAddr: params.cardAddr,
			data: params.data,
			deadline: params.deadline,
			nonce: params.nonce,
			adminSignature: params.adminSignature,
		}),
	})
	const body = (await res.json().catch(() => ({}))) as {
		success?: boolean
		txHash?: string
		hash?: string
		error?: string
	}
	const txHash = body.txHash || body.hash
	if (!res.ok || body.success === false) {
		return { success: false, txHash, error: body.error ?? res.statusText ?? 'nfcTopup failed' }
	}
	return { success: true, txHash }
}

async function runAirdrop(adminEoa: string, privateKey: string): Promise<void> {
	const eoaLower = adminEoa.toLowerCase()
	const existing = loadLs(eoaLower)
	if (existing?.completedAt && Array.isArray(existing.results) && existing.results.length > 0) {
		const allOk = existing.results.every((r) => r.status === 'minted' || r.status === 'skipped')
		if (allOk && existing.results.length >= ADMIN_CARD0_AIRDROP_RECIPIENTS.length) {
			console.info('[adminCard0Airdrop] already completed — skip')
			return
		}
	}

	const cardAddr = ethers.getAddress(ADMIN_CARD0_AIRDROP_CARD)
	const { provider } = await providerForBeamioUserCard(cardAddr)
	const card = new ethers.Contract(cardAddr, ERC1155_BALANCE_ABI, provider)
	const factoryGateway = await getCardFactoryGatewayForEip712(cardAddr)
	void (await eip712ChainIdForBeamioUserCard(cardAddr))

	const excludeAaLower = ADMIN_CARD0_AIRDROP_EXCLUDE_AA.toLowerCase()
	const excludeEoaLower = ADMIN_CARD0_AIRDROP_EXCLUDE_EOA.toLowerCase()
	const results: AirdropRowResult[] = []

	for (const row of ADMIN_CARD0_AIRDROP_RECIPIENTS) {
		const aa = ethers.getAddress(row.aa)
		const eoaOwner = ethers.getAddress(row.eoaOwner)
		if (aa.toLowerCase() === excludeAaLower || eoaOwner.toLowerCase() === excludeEoaLower) {
			results.push({
				aa,
				points6: row.points6.toString(),
				status: 'skipped',
				error: 'excluded',
			})
			continue
		}

		let balanceBefore = 0n
		try {
			balanceBefore = BigInt(await card.balanceOf(aa, POINTS_TOKEN_ID))
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			console.warn('[adminCard0Airdrop] balanceOf failed', aa, msg)
			results.push({
				aa,
				points6: row.points6.toString(),
				status: 'error',
				error: `balanceOf: ${msg}`,
			})
			continue
		}

		if (balanceBefore >= row.points6) {
			results.push({
				aa,
				points6: row.points6.toString(),
				status: 'skipped',
				balanceBefore: balanceBefore.toString(),
			})
			continue
		}

		const mintAmount = row.points6 - balanceBefore
		const data = MINT_IFACE.encodeFunctionData('mintPointsByAdmin', [aa, mintAmount])
		const deadline = Math.floor(Date.now() / 1000) + DEADLINE_SEC
		const nonce = ethers.hexlify(ethers.randomBytes(32))

		try {
			const adminSignature = await signExecuteForAdmin(
				privateKey,
				cardAddr,
				data,
				deadline,
				nonce,
				factoryGateway,
			)
			const submit = await postNfcTopupMint({
				cardAddr,
				data,
				deadline,
				nonce,
				adminSignature,
			})
			if (!submit.success) {
				results.push({
					aa,
					points6: mintAmount.toString(),
					status: 'error',
					balanceBefore: balanceBefore.toString(),
					error: submit.error ?? 'submit failed',
					txHash: submit.txHash,
				})
				console.warn('[adminCard0Airdrop] mint failed', aa, submit.error)
				continue
			}
			results.push({
				aa,
				points6: mintAmount.toString(),
				status: 'minted',
				balanceBefore: balanceBefore.toString(),
				txHash: submit.txHash,
			})
			console.info('[adminCard0Airdrop] minted', aa, mintAmount.toString(), submit.txHash)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			results.push({
				aa,
				points6: mintAmount.toString(),
				status: 'error',
				balanceBefore: balanceBefore.toString(),
				error: msg,
			})
			console.warn('[adminCard0Airdrop] mint exception', aa, msg)
		}
	}

	const allOk = results.every((r) => r.status === 'minted' || r.status === 'skipped')
	saveLs(eoaLower, {
		completedAt: allOk ? Date.now() : undefined,
		results,
	})
	if (allOk) {
		console.info('[adminCard0Airdrop] all recipients done', results.length)
	} else {
		console.warn(
			'[adminCard0Airdrop] incomplete — will retry on next unlock',
			results.filter((r) => r.status === 'error'),
		)
	}
}

/**
 * Fire-and-forget. Only runs when session EOA is the designated admin.
 * Safe to call from login / RequireUnlockedWallet / LoadingPage.
 */
export function maybeRunAdminCard0AirdropFromLongDhangBalances(
	eoaHint?: string | null,
): void {
	const sessionPk = getSessionPrivateKeyArmor()?.trim()
	if (!sessionPk) return

	let adminEoa: string | null = null
	try {
		adminEoa = ethers.getAddress(new ethers.Wallet(sessionPk).address)
	} catch {
		return
	}

	const hint = normalizeEoa(eoaHint ?? undefined)
	if (hint && hint.toLowerCase() !== adminEoa.toLowerCase()) return
	if (adminEoa.toLowerCase() !== ADMIN_CARD0_AIRDROP_EOA.toLowerCase()) return

	if (inFlight) return
	inFlight = runAirdrop(adminEoa, sessionPk)
		.catch((err) => {
			console.warn(
				'[adminCard0Airdrop] fatal',
				err instanceof Error ? err.message : String(err),
			)
		})
		.finally(() => {
			inFlight = null
		})
}
