import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'
import { openExternalUrl } from '@/utils/openExternalUrl'
import {
	getBeamioLegalDocument,
	type BeamioLegalBlock,
	type BeamioLegalDocId,
	type BeamioLegalDocument,
	type BeamioLegalSection,
} from '@/utils/beamioLegalDocuments'

function LegalBlocks({ blocks }: { blocks: BeamioLegalBlock[] }) {
	if (!blocks.length) return null
	return (
		<div className="space-y-2">
			{blocks.map((block, i) =>
				block.kind === 'ul' ? (
					<ul key={i} className="list-disc space-y-1.5 pl-5">
						{block.items.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				) : (
					<p key={i}>{block.text}</p>
				)
			)}
		</div>
	)
}

function LegalSectionView({ section }: { section: BeamioLegalSection }) {
	return (
		<section className="space-y-2">
			<h3 className="text-base font-semibold tracking-tight text-slate-900">{section.heading}</h3>
			<LegalBlocks blocks={section.blocks} />
			{section.subsections?.map((sub) => (
				<div key={sub.heading} className="space-y-1.5 pl-0 sm:pl-1">
					<h4 className="text-sm font-semibold text-slate-900">{sub.heading}</h4>
					<LegalBlocks blocks={sub.blocks} />
				</div>
			))}
		</section>
	)
}

export function MerchantLegalDocumentView({
	doc,
	eyebrow,
}: {
	doc: BeamioLegalDocument
	eyebrow?: string
}) {
	const last = doc.sections[doc.sections.length - 1]
	const showContactMail = Boolean(doc.contactEmail)
	const bodySections =
		showContactMail && last?.heading.startsWith('7.') ? doc.sections.slice(0, -1) : doc.sections

	return (
		<div className="mx-auto w-full max-w-2xl overflow-x-hidden font-sans text-[#2c2f31] antialiased">
			<header className="mb-8 mt-4">
				{eyebrow ? (
					<p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.05em] text-[#0051d1]">{eyebrow}</p>
				) : null}
				<h3 className="font-manrope text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
					{doc.title}
				</h3>
				{doc.lastUpdatedLabel ? (
					<p className="mt-2 text-xs font-medium text-[#595c5e]">{doc.lastUpdatedLabel}</p>
				) : null}
			</header>

			<article className="space-y-6 text-sm leading-relaxed text-slate-700">
				{doc.notice ? <p className="font-semibold text-slate-900">{doc.notice}</p> : null}
				{doc.intro.map((p) => (
					<p key={p}>{p}</p>
				))}
				{bodySections.map((section) => (
					<LegalSectionView key={section.heading} section={section} />
				))}
				{showContactMail && last ? (
					<section className="space-y-2">
						<h3 className="text-base font-semibold tracking-tight text-slate-900">{last.heading}</h3>
						<LegalBlocks blocks={last.blocks} />
						<p>
							<button
								type="button"
								className="font-semibold text-[#0051d1] underline-offset-2 hover:underline"
								onClick={() => openExternalUrl(`mailto:${doc.contactEmail}`)}
							>
								{doc.contactEmail}
							</button>
						</p>
					</section>
				) : null}
			</article>
		</div>
	)
}

export function MerchantLegalDocumentPanel({ docId }: { docId: BeamioLegalDocId }) {
	const { tu } = useTu()
	const locale = getCurrentBeamioUiLocale()
	const doc = getBeamioLegalDocument(docId, locale)
	return (
		<div className="relative z-10 mx-auto w-full max-w-2xl animate-in fade-in duration-300 overflow-x-hidden px-4 pb-16 sm:px-6">
			<MerchantLegalDocumentView doc={doc} eyebrow={tu('legal')} />
		</div>
	)
}
