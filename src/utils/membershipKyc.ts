import { Contract, JsonRpcProvider, Wallet, getAddress, hexlify, keccak256, toUtf8Bytes, ZeroHash } from 'ethers'
import { createMessage, encrypt, readKey } from 'openpgp'
import { CONET_ADDRESS_PGP, CONET_CARD_FACTORY, CONET_RPC_URL } from '@/config/chainAddresses'
import { displayFiatPrefixFromCode } from '@/services/currency'

export type KycFieldMode = 'off' | 'optional' | 'required'

export type MembershipKycExtraField = {
	id: string
	label: string
	purpose: string
	type: string
	options: string[]
	state: KycFieldMode
}

export type MembershipKycFormPolicy = {
	enabled: boolean
	merchantName: string
	fields: { name: KycFieldMode; phone: KycFieldMode; email: KycFieldMode }
	/** Biz “Show opt-in options”. Absent or false means do not ask for email or SMS marketing. */
	marketing: boolean
	mailingAddress: string
	additionalFields: MembershipKycExtraField[]
	privacyNotice: string
	terms: string
	offerLabel: string
	offerValue: string
	offerReward: string
}

const provider = new JsonRpcProvider(CONET_RPC_URL)
const CARD_ABI = [
	'function kycIpfsHashOf(address) view returns (bytes32)',
	'function activeMembershipId(address) view returns (uint256)',
	'function getAdminListWithMetadata() view returns (address[] admins, string[] metadatas, address[] parents)',
	'function factoryGateway() view returns (address)',
	'function name() view returns (string)',
]
const PGP_ABI = [
	'function searchKey(address) view returns (string userPgpKeyID, string userPublicKeyArmored, string routePgpKeyID, string routePublicKeyArmored, bool routeOnline)',
]

function fieldMode(raw: unknown, fallback: KycFieldMode): KycFieldMode {
	if (raw === 'required' || raw === 2 || raw === '2') return 'required'
	if (raw === 'off' || raw === 0 || raw === '0') return 'off'
	if (raw === 'optional' || raw === 1 || raw === '1') return 'optional'
	return fallback
}

const DURATION_PHRASE = ['', '1 day', '1 week', '1 month', '1 quarter', '1 year', 'Lifetime']

function publishedTemplateDocuments(kyc: Record<string, unknown>, merchantName: string, meta: {
	currency?: string
	baseMembership?: { membershipFeeE6?: string; membershipDurationKind?: number }
	tiers?: Array<Record<string, unknown>>
}): { privacyNotice: string; terms: string } {
	const entity = typeof kyc.entity === 'string' && kyc.entity.trim() ? kyc.entity.trim() : merchantName
	const phone = typeof kyc.contactPhone === 'string' ? kyc.contactPhone.trim() : ''
	const email = typeof kyc.contactEmail === 'string' ? kyc.contactEmail.trim() : ''
	const contact = [phone ? `Phone: ${phone}` : '', email ? `Email: ${email}` : ''].filter(Boolean).join(' · ')
	const address = typeof kyc.address === 'string' && kyc.address.trim() ? kyc.address.trim() : '[Business address required]'
	const fields = (kyc.fields ?? {}) as Record<string, unknown>
	const labels: Record<string, string> = { name: 'Full name', phone: 'Phone number', email: 'Email' }
	const collected = (['name', 'phone', 'email'] as const)
		.filter((key) => fields[key] === 'required' || fields[key] === 'optional')
		.map((key) => `${labels[key]} (${fields[key]})`)
	const extra = Array.isArray(kyc.additionalFields)
		? kyc.additionalFields.flatMap((row) => {
			if (!row || typeof row !== 'object') return []
			const item = row as Record<string, unknown>
			if (item.state === 'off' || typeof item.label !== 'string' || !item.label.trim()) return []
			return [`${item.label.trim()} (${typeof item.state === 'string' ? item.state : 'optional'})`]
		})
		: []
	const summary = [...collected, ...extra].join(' · ') || 'Wallet ID and membership records only · No additional details'
	const asksDetails = collected.length > 0 || extra.length > 0
	const usageLines = (['name', 'phone', 'email'] as const)
		.filter((key) => fields[key] === 'required' || fields[key] === 'optional')
		.map((key) => key === 'name'
			? 'Name: Used by the merchant to address you by name.'
			: `${labels[key]}: Used by the merchant to contact you about your membership and respond to support requests.`)
	const extraUsage = Array.isArray(kyc.additionalFields)
		? kyc.additionalFields.flatMap((row) => {
			if (!row || typeof row !== 'object') return []
			const item = row as Record<string, unknown>
			if (item.state === 'off' || typeof item.label !== 'string' || !item.label.trim()) return []
			const purpose = typeof item.purpose === 'string' && item.purpose.trim()
				? item.purpose.trim()
				: 'Requested by the merchant for membership services.'
			return [`${item.label.trim()}: ${purpose}`]
		})
		: []
	const privacyNotice = [
		'MEMBERSHIP PRIVACY NOTICE',
		`${entity} · trading as ${merchantName}`,
		'',
		'1. Information and purpose',
		asksDetails
			? `We collect ${summary} to create and manage memberships and provide customer support. Required fields are marked on the form. Optional fields may be left blank.`
			: 'We do not request your name, phone number, or email during enrollment. Your wallet ID and membership records are used to create and manage memberships and provide customer support.',
		'',
		'Membership identifiers, top-up and redemption records, balances, and consent records are processed to administer the membership. Providing contact details does not enroll you in marketing.',
		'',
		'2. Wallet identity and merchant access',
		'Your wallet address is your membership ID on CoNET L1. You control your own private key. We access our member information through Business OS using our business private key. Beamio provides the decentralized technology and tools; it does not hold customer or merchant private keys or operate a centralized member-data processing service. We, the merchant, determine the collection purposes and membership rules. Contact us about our use of your information.',
		'',
		'3. Merchant data-use rules and on-chain records',
		[[...usageLines, ...extraUsage].join('\n'), `Your information is used by ${entity} to manage your membership and assist with membership-related requests. Marketing messages are sent only if you opt in.`, `The merchant accesses its member information through Business OS using its own private key on CoNET L1. Withdrawing consent does not erase existing on-chain records. Contact ${contact || 'the merchant contact shown in this notice'} about your information or future use.`].filter(Boolean).join('\n\n'),
		'Information is recorded on CoNET L1. Withdrawal of consent or membership closure does not erase existing on-chain records. We do not promise deletion of immutable records. Requests concerning future use are handled by our business in accordance with applicable requirements and supported technical controls.',
		'',
		'4. Your choices',
		'Contact our business to request access, correction where technically supported, or withdrawal of consent for future use, subject to applicable restrictions. We will explain any effect on membership services. Unsubscribing from marketing does not cancel your membership or remove store credits.',
		'',
		'5. Changes and contact',
		'We will communicate material changes and obtain fresh consent where required.',
		`Privacy contact: ${contact || '[Phone or email required]'}`,
		`Business: ${entity}`,
		`Address: ${address}`,
	].join('\n')

	const prefix = displayFiatPrefixFromCode(meta.currency, 'CAD')
	const money = (e6: string | undefined) => {
		try {
			const n = Number(BigInt(e6 || '0')) / 1_000_000
			if (!Number.isFinite(n) || n < 0) return ''
			if (n === 0) return `${prefix}0`
			return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
		} catch {
			return ''
		}
	}
	const base = meta.baseMembership
	const baseKind = Number(base?.membershipDurationKind ?? 0)
	const membershipFee = baseKind >= 1 && baseKind <= 6
	const tierLines: string[] = []
	if (membershipFee) {
		const amount = money(base?.membershipFeeE6)
		const duration = DURATION_PHRASE[baseKind] || 'Duration set by the merchant'
		if (amount) tierLines.push(`Membership: Pay ${amount} once · ${duration} · Member benefits`)
	}
	for (const tier of meta.tiers ?? []) {
		const name = typeof tier.name === 'string' ? tier.name.trim() : ''
		const amount = money(typeof tier.membershipFeeE6 === 'string' ? tier.membershipFeeE6 : undefined)
		const kind = Number(tier.membershipDurationKind ?? 0)
		if (!name || !amount) continue
		const duration = kind >= 1 && kind <= 6 ? DURATION_PHRASE[kind] : 'Duration set by the merchant'
		tierLines.push(`${name}: Pay ${amount} once · ${duration} · Member benefits`)
	}
	const modelLabel = membershipFee ? 'One-time membership fee' : 'Single top-up'
	const terms = [
		'MEMBERSHIP TERMS',
		`${entity} · ${modelLabel}`,
		'',
		'1. Membership eligibility & duration',
		membershipFee
			? 'Membership starts after the one-time membership fee for the selected tier is paid successfully. It lasts for the duration set on that tier. There is no automatic renewal. The fee does not include store credits. A lifetime duration lasts while the merchant operates the program.'
			: 'Membership starts after a successful top-up that meets a published tier threshold. It does not expire. A later top-up can qualify the customer for a higher tier. Membership duration and store-credit expiry are separate.',
		'',
		'2. Benefits',
		tierLines.join('\n') || 'No membership tiers are set yet.',
		"All tier thresholds and benefits shown here are the merchant's published settings.",
		'',
		'3. Refunds and qualification changes',
		membershipFee
			? 'Contact the merchant about fee refunds. Applicable consumer rights remain unaffected.'
			: 'Top-up refunds and related tier changes follow the merchant policy disclosed before purchase.',
		'',
		'4. Expiry and renewal',
		membershipFee
			? 'No automatic renewal. Membership duration follows the tier the customer joined. Membership duration and store-credit expiry are separate.'
			: 'Single top-up and cumulative-spending memberships do not expire. Membership and credit expiry must not be conflated.',
		'',
		'5. Merchant and technology roles',
		'The merchant sets, approves, and issues the membership. Beamio provides the technology and tools on CoNET L1. Wallet addresses identify members. Each party controls its own private key.',
		'',
		'6. Privacy and support',
		`Member information is handled under the ${merchantName} Privacy Notice. Contact: ${contact || 'the contact in the Privacy Notice'}.`,
	].join('\n')
	return { privacyNotice, terms }
}

function armorFromStored(raw: string): string {
	const text = raw.trim()
	if (text.includes('BEGIN PGP PUBLIC KEY')) return text
	try {
		const decoded = atob(text)
		if (decoded.includes('BEGIN PGP PUBLIC KEY')) return decoded
	} catch {
		/* stored value is not base64 armor */
	}
	return ''
}

export async function loadMembershipKycPolicy(cardAddress: string): Promise<MembershipKycFormPolicy | null> {
	const card = getAddress(cardAddress)
	const response = await fetch(`https://beamio.app/api/cardMetadata?cardAddress=${card}`)
	if (!response.ok) {
		throw new Error('Could not load membership details.')
	}
	const body = (await response.json()) as {
		metadata_json?: unknown
		metadata?: unknown
		name?: string
		cardCurrency?: string
		currency?: string
	}
	const meta = (body.metadata_json ?? body.metadata ?? body) as {
		name?: string
		baseMembership?: { membershipFeeE6?: string; membershipDurationKind?: number }
		tiers?: Array<Record<string, unknown>>
		shareTokenMetadata?: {
			kyc?: Record<string, unknown>
			name?: string
			displayName?: string
			storeName?: string
			businessName?: string
			businessProfile?: { storeName?: string }
		}
	}
	const share = meta.shareTokenMetadata
	const kyc = share?.kyc
	if (!kyc || typeof kyc !== 'object' || !kyc.fields || typeof kyc.fields !== 'object') return null
	const fields = kyc.fields as Record<string, unknown>
	const hasConfiguredCoreField = (['name', 'phone', 'email'] as const).some((field) => {
		const mode = fieldMode(fields[field], 'off')
		return mode === 'required' || mode === 'optional'
	})
	const additionalFields = Array.isArray(kyc.additionalFields)
		? kyc.additionalFields.flatMap((row) => {
				if (!row || typeof row !== 'object') return []
				const item = row as Record<string, unknown>
				const state = fieldMode(item.state, 'off')
				const label = typeof item.label === 'string' ? item.label.trim() : ''
				if (state === 'off' || !label) return []
				return [{
					id: typeof item.id === 'string' && item.id.trim() ? item.id : label,
					label,
					purpose: typeof item.purpose === 'string' ? item.purpose.trim() : '',
					type: typeof item.type === 'string' ? item.type : 'text',
					options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0) : [],
					state,
				}]
			})
		: []
	// A published KYC block with every field turned off is not a KYC
	// requirement. Keep the zero-fee deep-link flow on the direct claim path.
	if (!hasConfiguredCoreField && additionalFields.length === 0) return null
	const merchantName = String(
		share?.businessProfile?.storeName ||
			share?.displayName ||
			share?.storeName ||
			share?.businessName ||
			kyc.entity ||
			share?.name ||
			meta.name ||
			'Merchant',
	)
	const storedPrivacy = typeof kyc.privacyNotice === 'string' ? kyc.privacyNotice.trim() : ''
	const storedTerms = typeof kyc.terms === 'string' ? kyc.terms.trim() : ''
	const generated = kyc.policyMode === 'custom'
		? { privacyNotice: storedPrivacy, terms: storedTerms }
		: publishedTemplateDocuments(kyc, merchantName, {
			currency: body.cardCurrency || body.currency,
			baseMembership: meta.baseMembership,
			tiers: meta.tiers,
		})
	return {
		enabled: true,
		merchantName,
		fields: {
			name: fieldMode(fields.name, 'off'),
			phone: fieldMode(fields.phone, 'off'),
			email: fieldMode(fields.email, 'off'),
		},
		marketing: kyc.marketing === true,
		mailingAddress: typeof kyc.mailingAddress === 'string' ? kyc.mailingAddress.trim() : '',
		additionalFields,
		privacyNotice: storedPrivacy || generated.privacyNotice,
		terms: storedTerms || generated.terms,
		offerLabel: 'Store Credits',
		offerValue: '',
		offerReward: '',
	}
}

async function walletAlreadyHoldsMembership(cardAddress: string, wallet: string): Promise<boolean> {
	try {
		const card = new Contract(getAddress(cardAddress), CARD_ABI, provider)
		const id = (await card.activeMembershipId(getAddress(wallet))) as bigint
		return id >= 100n
	} catch {
		return false
	}
}

/** First membership on a KYC card. A previously stored ciphertext hash does not skip the form. */
export async function membershipJoinShouldShowKyc(cardAddress: string, wallets: string[]): Promise<boolean> {
	// A failed metadata request is not evidence that the merchant has no KYC
	// policy. Let the caller keep the membership flow blocked until the policy
	// can be trusted.
	const policy = await loadMembershipKycPolicy(cardAddress)
	if (!policy) return false
	for (const wallet of wallets) {
		if (!wallet) continue
		if (await walletAlreadyHoldsMembership(cardAddress, wallet)) return false
	}
	return true
}

export async function membershipIssueNeedsKyc(cardAddress: string, wallet: string): Promise<boolean> {
	if (!(await membershipJoinShouldShowKyc(cardAddress, [wallet]))) return false
	return !(await membershipKycAlreadyLinked(cardAddress, wallet))
}

export async function membershipKycAlreadyLinked(cardAddress: string, wallet: string): Promise<boolean> {
	try {
		const card = new Contract(getAddress(cardAddress), CARD_ABI, provider)
		const hash = (await card.kycIpfsHashOf(getAddress(wallet))) as string
		return Boolean(hash) && hash !== ZeroHash
	} catch {
		return false
	}
}

async function adminEncryptionKeys(cardAddress: string) {
	const card = new Contract(getAddress(cardAddress), CARD_ABI, provider)
	const pgp = new Contract(CONET_ADDRESS_PGP, PGP_ABI, provider)
	const admins = (await card.getAdminListWithMetadata())[0] as string[]
	const keys = []
	for (const admin of admins) {
		try {
			const row = await pgp.searchKey(getAddress(admin))
			const armored = armorFromStored(String(row[1] || ''))
			if (!armored) continue
			keys.push(await readKey({ armoredKey: armored }))
		} catch {
			/* this admin has no usable public key */
		}
	}
	if (keys.length === 0) {
		throw new Error('No merchant admin has a registered encryption key.')
	}
	return keys
}

export async function saveMembershipKycAndLink(params: {
	cardAddress: string
	privateKey: string
	fullName: string
	phone: string
	email: string
	privacyConsent: boolean
	emailOffers: boolean
	smsOffers: boolean
	additional?: Record<string, string | string[]>
	signerKind: 'wallet' | 'admin'
	subjectWallet: string
}): Promise<void> {
	const signer = new Wallet(params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`)
	const subject = getAddress(params.subjectWallet)
	const payload = JSON.stringify({
		v: 1,
		card: getAddress(params.cardAddress),
		wallet: subject,
		fullName: params.fullName.trim(),
		phone: params.phone.trim(),
		email: params.email.trim(),
		privacyConsent: params.privacyConsent,
		emailOffers: params.emailOffers,
		smsOffers: params.smsOffers,
		additional: params.additional ?? {},
		savedAt: Date.now(),
	})
	const keys = await adminEncryptionKeys(params.cardAddress)
	const message = await createMessage({ text: payload })
	const armored = await encrypt({ message, encryptionKeys: keys, format: 'armored' })
	const signMessage = await signer.signMessage(signer.address)
	const uploaded = await fetch('https://ipfs.conet.network/api/storageFragment', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ wallet: signer.address, signMessage, image: armored }),
	})
	if (!uploaded.ok) throw new Error('Could not store the encrypted membership details.')
	const ipfsHash = keccak256(toUtf8Bytes(String(armored)))
	const card = new Contract(getAddress(params.cardAddress), CARD_ABI, provider)
	const factory = (await card.factoryGateway()) as string
	const deadline = Math.floor(Date.now() / 1000) + 600
	const nonce = BigInt(hexlify(crypto.getRandomValues(new Uint8Array(16))))
	const domain = {
		name: 'BeamioUserCardFactory',
		version: '1',
		chainId: 224422,
		verifyingContract: factory || CONET_CARD_FACTORY,
	}
	const value = { wallet: subject, ipfsHash, deadline, nonce }
	const signature =
		params.signerKind === 'admin'
			? await signer.signTypedData(
					domain,
					{
						LinkKycIpfsHashByAdmin: [
							{ name: 'wallet', type: 'address' },
							{ name: 'ipfsHash', type: 'bytes32' },
							{ name: 'deadline', type: 'uint256' },
							{ name: 'nonce', type: 'uint256' },
						],
					},
					value,
				)
			: await signer.signTypedData(
					domain,
					{
						LinkKycIpfsHash: [
							{ name: 'wallet', type: 'address' },
							{ name: 'ipfsHash', type: 'bytes32' },
							{ name: 'deadline', type: 'uint256' },
							{ name: 'nonce', type: 'uint256' },
						],
					},
					value,
				)
	const response = await fetch('https://beamio.app/api/linkMembershipKyc', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			cardAddress: getAddress(params.cardAddress),
			wallet: subject,
			ipfsHash,
			deadline: deadline.toString(),
			nonce: nonce.toString(),
			signature,
			signerKind: params.signerKind,
		}),
	})
	const result = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string }
	if (!response.ok || result.success === false) {
		throw new Error(result.error || 'Could not link these membership details to your wallet.')
	}
}
