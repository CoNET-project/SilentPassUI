import { Briefcase } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'
import { BIZ_PUBLIC_LOGO512 } from '@/pages/Home/brandUi'
import { IpfsImg } from '@/components/IpfsImg'
import type { BizWorkspaceRole } from '@/utils/agentWorkspaceLocal'

const headlineFont = {
	fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const

type Props = {
	appVersion?: string
	onChoose: (role: BizWorkspaceRole) => void
}

export default function OnboardingRoleChoiceScreen({ appVersion, onChoose }: Props) {
	const { tu } = useTu()

	return (
		<div
			className="
				relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-[#F5F6F8] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#121212]
				pt-[env(safe-area-inset-top)]
				pb-[env(safe-area-inset-bottom)]
				pl-[env(safe-area-inset-left)]
				pr-[env(safe-area-inset-right)]
			"
			style={{
				backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.35) 0.7px, transparent 0.7px)',
				backgroundSize: '18px 18px',
			}}
		>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#E8EEF9]/90 to-transparent"
				aria-hidden
			/>
			{appVersion ? (
				<div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+0.5rem)] left-6 z-[5] text-[11px] font-medium text-[#abadaf] lg:left-8">
					v{appVersion}
				</div>
			) : null}

			<header className="relative z-30 flex shrink-0 items-center justify-between gap-3 overflow-visible px-5 pt-5 lg:px-8">
				<div className="flex items-center justify-center gap-1.5 lg:justify-start">
					<IpfsImg
						src={BIZ_PUBLIC_LOGO512}
						alt=""
						className="h-8 w-8 shrink-0 rounded-full object-contain"
					/>
					<span className="text-xl font-extrabold tracking-tighter text-[#1562F0]" style={headlineFont}>
						{tu('onb_beamio_business_lite')}
					</span>
				</div>
			</header>

			<main className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10 pt-8">
				<div className="mb-8 max-w-md text-center">
					<p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1562F0]/80">
						{tu('onb_role_eyebrow')}
					</p>
					<h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[#121212]" style={headlineFont}>
						{tu('onb_role_title')}
					</h1>
					<p className="leading-relaxed text-[#666666]">{tu('onb_role_sub')}</p>
				</div>

				<div className="grid w-full max-w-md gap-4">
					<button
						type="button"
						onClick={() => onChoose('merchant')}
						className="group flex flex-col items-start gap-3 rounded-3xl border border-white/80 bg-white p-6 text-left shadow-[0_8px_40px_rgba(15,23,42,0.06)] transition hover:border-[#1562F0]/35 hover:shadow-[0_12px_40px_rgba(21,98,240,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562F0]"
					>
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9edff] text-[#0051d1]">
							<Briefcase className="h-6 w-6" aria-hidden />
						</span>
						<span className="text-lg font-extrabold text-[#121212]" style={headlineFont}>
							{tu('onb_role_merchant_title')}
						</span>
						<span className="text-sm leading-relaxed text-[#666666]">
							{tu('onb_role_merchant_desc')}
						</span>
						<span className="mt-1 text-[13px] font-bold text-[#1562F0] group-hover:underline">
							{tu('onb_role_merchant_cta')}
						</span>
					</button>
				</div>
			</main>
		</div>
	)
}
