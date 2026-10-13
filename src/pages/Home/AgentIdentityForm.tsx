import BusinessIdentityForm, {
	type BusinessIdentityFormProps,
	type BusinessIdentitySuccess,
} from '@/pages/Home/BusinessIdentityForm'
import { useTu } from '@/locale/beamioLocale'

export type { BusinessIdentitySuccess }

type Props = Omit<BusinessIdentityFormProps, 'showIntroHeader' | 'isRedeemFlow' | 'recoveryDraft'>

/**
 * Agent workspace registration — same createRecover path as merchant identity,
 * with agent-facing copy. Parent skips Recovery QR and routes to `/agent`.
 */
export default function AgentIdentityForm(props: Props) {
	const { tu } = useTu()

	return (
		<>
			<div className="mb-10 text-center">
				<p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d3a8b]/90">
					{tu('onb_agent_identity_eyebrow')}
				</p>
				<h2 className="biz-identity-headline mb-2 text-3xl font-extrabold tracking-tight text-[#121212]">
					{tu('onb_agent_identity_title')}
				</h2>
				<p className="leading-relaxed text-[#666666]">{tu('onb_agent_identity_sub')}</p>
			</div>
			<BusinessIdentityForm {...props} showIntroHeader={false} />
		</>
	)
}
