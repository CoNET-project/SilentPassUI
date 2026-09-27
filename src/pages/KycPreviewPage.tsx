import { BecomeMemberSheet } from '@/components/Home/BecomeMemberSheet'

const policy = {
	enabled: true,
	merchantName: 'LONGDHANG',
	fields: { name: 'required' as const, phone: 'optional' as const, email: 'optional' as const },
	offerLabel: 'Store Credits',
	offerValue: 'TOP UP CA$100',
	offerReward: 'Get CA$110',
}

export default function KycPreviewPage() {
	return (
		<BecomeMemberSheet
			policy={policy}
			cardAddress="0x0000000000000000000000000000000000000000"
			privateKey=""
			subjectWallet="0x0000000000000000000000000000000000000001"
			signerKind="wallet"
			onClose={() => undefined}
			onLinked={() => undefined}
		/>
	)
}
