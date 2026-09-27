import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Circle, Loader2, X } from 'lucide-react';
import { updateBeamioCardShareMetadata } from '@/services/BeamioCard';

type CollectMode = 'optional' | 'required' | 'off';
type PolicyMode = 'template' | 'custom';
type CollectionPurpose = 'profile' | 'service';
type PreviewKind = 'privacy' | 'terms';

type FieldKey = 'name' | 'phone' | 'email';

type KycDraft = {
  enabled: boolean;
  fields: Record<FieldKey, CollectMode>;
  purposes: Record<FieldKey, string>;
  policyMode: PolicyMode;
  entity: string;
  phone: string;
  email: string;
  address: string;
  collectionPurpose: CollectionPurpose;
  locations: string;
  refunds: string;
  expiry: string;
  useRules: string;
  fees: string;
  customPrivacy: string;
  customTerms: string;
  marketing: boolean;
  mailingAddress: string;
  approved: boolean;
};

type StoredKyc = {
  draft: KycDraft;
  published: KycDraft | null;
};

const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Full name',
  phone: 'Phone number',
  email: 'Email',
};

const FIELD_HINT: Record<FieldKey, string> = {
  name: 'Create a profile and personalize greetings',
  phone: 'Contact customers about membership services',
  email: 'Contact customers about membership services',
};

const PURPOSE_OPTIONS: Record<FieldKey, { value: string; label: string }[]> = {
  name: [
    { value: '', label: 'Select a necessary purpose' },
    { value: 'named', label: 'Issue a named, non-transferable membership' },
  ],
  phone: [
    { value: '', label: 'Select a necessary purpose' },
    { value: 'phone', label: 'Provide membership services that require phone contact' },
  ],
  email: [
    { value: '', label: 'Select a necessary purpose' },
    { value: 'email', label: 'Deliver membership services by email' },
  ],
};

const PURPOSE_COPY: Record<FieldKey, string> = {
  name: 'Your name is required because the merchant issues a named, non-transferable membership.',
  phone: 'Your phone number is required to provide the phone-based membership service selected by the merchant.',
  email: 'Your email is required to deliver the email-based membership service selected by the merchant.',
};

function defaultDraft(): KycDraft {
  return {
    enabled: true,
    fields: { name: 'optional', phone: 'off', email: 'optional' },
    purposes: { name: '', phone: '', email: '' },
    policyMode: 'template',
    entity: '',
    phone: '',
    email: '',
    address: '',
    collectionPurpose: 'profile',
    locations: '',
    refunds: '',
    expiry: 'Paid credits and bonus credits do not expire.',
    useRules: '',
    fees: 'No membership or top-up fees.',
    customPrivacy: '',
    customTerms: '',
    marketing: false,
    mailingAddress: '',
    approved: false,
  };
}

function storageKeyFor(cardKey: string): string {
  return `beamio:biz:kyc-enrollment:v1:${cardKey}`;
}

function readStored(cardKey: string): StoredKyc | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(cardKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredKyc;
    if (!parsed?.draft) return null;
    return {
      draft: { ...defaultDraft(), ...parsed.draft, fields: { ...defaultDraft().fields, ...parsed.draft.fields }, purposes: { ...defaultDraft().purposes, ...parsed.draft.purposes } },
      published: parsed.published
        ? {
            ...defaultDraft(),
            ...parsed.published,
            fields: { ...defaultDraft().fields, ...parsed.published.fields },
            purposes: { ...defaultDraft().purposes, ...parsed.published.purposes },
          }
        : null,
    };
  } catch {
    return null;
  }
}

function writeStored(cardKey: string, value: StoredKyc): void {
  localStorage.setItem(storageKeyFor(cardKey), JSON.stringify(value));
}

function contactLine(draft: KycDraft): string {
  const parts = [
    draft.phone.trim() ? `Phone: ${draft.phone.trim()}` : '',
    draft.email.trim() ? `Email: ${draft.email.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function collectedFields(draft: KycDraft): FieldKey[] {
  return (['name', 'phone', 'email'] as const).filter((key) => draft.fields[key] !== 'off');
}

function requiredFields(draft: KycDraft): FieldKey[] {
  return (['name', 'phone', 'email'] as const).filter((key) => draft.fields[key] === 'required');
}

function usageCopy(draft: KycDraft, merchantName: string): string {
  const merchant = draft.entity.trim() || merchantName || 'the merchant';
  const contact = contactLine(draft) || 'the merchant contact shown in this notice';
  const lines = collectedFields(draft).map((key) =>
    key === 'name'
      ? 'Name: Used by the merchant to address you by name.'
      : `${FIELD_LABEL[key]}: Used by the merchant to contact you about your membership and respond to support requests.`
  );
  const purpose =
    draft.collectionPurpose === 'profile'
      ? 'manage your membership'
      : 'manage your membership and respond to membership-related requests';
  const necessity = requiredFields(draft)
    .filter((key) => draft.purposes[key])
    .map((key) => PURPOSE_COPY[key])
    .join(' ');
  return [
    lines.join('\n'),
    necessity,
    `Your information is used by ${merchant} to ${purpose}. Promotional messages require a separate opt-in.`,
    `The merchant accesses its member information through Business OS using its own private key on CoNET L1. Withdrawing consent does not erase existing on-chain records. Contact ${contact} about your information or future use.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function privacyDocument(draft: KycDraft, merchantName: string): string {
  if (draft.policyMode === 'custom') return draft.customPrivacy.trim();
  const entity = draft.entity.trim() || '[Legal business name required]';
  const contact = contactLine(draft) || '[Phone or email required]';
  const address = draft.address.trim() || '[Business address required]';
  const purpose =
    draft.collectionPurpose === 'profile'
      ? 'create and manage your member profile'
      : 'manage your membership and provide customer support';
  return [
    'MEMBERSHIP PRIVACY NOTICE',
    `${entity} · trading as ${merchantName || 'this business'}`,
    '',
    '1. Who collects member information',
    `${entity} collects the details you choose to provide when you join. Contact: ${contact}. Mailing address: ${address}.`,
    '',
    '2. What is collected',
    collectedFields(draft).length
      ? collectedFields(draft)
          .map((key) => `${FIELD_LABEL[key]} (${draft.fields[key]})`)
          .join('\n')
      : 'No contact fields are collected at enrollment.',
    '',
    '3. Why it is used',
    `Information is used to ${purpose}.`,
    usageCopy(draft, merchantName),
    '',
    '4. Wallet identity',
    'Wallet addresses identify members on CoNET L1. Customers control their own private keys. The business accesses member information in Business OS with its own private key. Beamio provides technical tools and does not hold those private keys.',
  ].join('\n');
}

function termsDocument(draft: KycDraft, merchantName: string): string {
  if (draft.policyMode === 'custom') return draft.customTerms.trim();
  const entity = draft.entity.trim() || merchantName || 'This business';
  return [
    'MEMBERSHIP & STORE CREDIT TERMS',
    entity,
    '',
    draft.locations.trim() ? `Eligible locations: ${draft.locations.trim()}` : 'Eligible locations: as stated by the business at the point of sale.',
    draft.refunds.trim() ? `Top-up refunds: ${draft.refunds.trim()}` : 'Top-up refunds: follow the business refund policy shown at purchase.',
    `Credit expiry: ${draft.expiry.trim() || 'Paid credits and bonus credits do not expire.'}`,
    `Use, exclusions, and transfer: ${draft.useRules.trim() || '[Use rules required]'}`,
    `Fees: ${draft.fees.trim() || 'No membership or top-up fees.'}`,
  ].join('\n');
}

function validatePublish(draft: KycDraft): string {
  if (!draft.enabled) return '';
  if (!draft.entity.trim()) return 'Add the legal business name before publishing.';
  if (!draft.phone.trim() && !draft.email.trim()) return 'Add a phone number or email for the privacy contact.';
  if (!draft.address.trim()) return 'Add the business mailing address before publishing.';
  for (const key of requiredFields(draft)) {
    if (!draft.purposes[key]) return `Choose a purpose for the required ${FIELD_LABEL[key].toLowerCase()} field.`;
  }
  if (draft.policyMode === 'custom') {
    if (!draft.customPrivacy.trim() || !draft.customTerms.trim()) {
      return 'Paste both your Privacy Notice and Membership Terms, or switch back to generated policies.';
    }
  } else if (!draft.useRules.trim()) {
    return 'Add use, exclusions, and transfer rules before publishing.';
  }
  if (draft.marketing && !draft.mailingAddress.trim()) {
    return 'Add the sender mailing address before showing marketing opt-in options.';
  }
  if (!draft.approved) return 'Review and approve these policies for your business before publishing.';
  return '';
}

const selectClass =
  'w-full appearance-none rounded-xl border border-[#d8dce2] bg-white py-2.5 pl-3 pr-9 text-sm text-[#1c1e21] outline-none focus:border-[#1562f0]';

const COLLECT_MODE_BUTTONS: { mode: CollectMode; label: string; textClass: string; Icon: typeof Check }[] = [
  { mode: 'required', label: 'Required', textClass: 'text-[#b42318]', Icon: Check },
  { mode: 'optional', label: 'Optional', textClass: 'text-[#1562f0]', Icon: Circle },
  { mode: 'off', label: 'Do not collect', textClass: 'text-[#9aa0a6]', Icon: X },
];

function FieldCollectRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: CollectMode;
  onChange: (value: CollectMode) => void;
}) {
  const status = COLLECT_MODE_BUTTONS.find((item) => item.mode === value) ?? COLLECT_MODE_BUTTONS[1];
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1c1e21]">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs leading-4">
          <span className="text-[#6b7076]">{hint}</span>
          <span className={`font-medium ${status.textClass}`}>{status.label}</span>
        </p>
      </div>
      <div role="group" aria-label={label} className="inline-flex shrink-0 overflow-hidden rounded-lg border border-[#d8dce2]">
        {COLLECT_MODE_BUTTONS.map(({ mode, label: modeLabel, Icon }, index) => {
          const selected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-label={modeLabel}
              aria-pressed={selected}
              title={modeLabel}
              onClick={() => onChange(mode)}
              className={`inline-flex h-8 w-9 items-center justify-center ${index > 0 ? 'border-l border-[#d8dce2]' : ''} ${
                selected ? 'bg-[#1562f0] text-white' : 'bg-white text-[#6b7076] hover:bg-[#1562f0]/8'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProgramKycEnrollmentPage({
  merchantName,
  cardKey,
}: {
  merchantName: string;
  cardKey: string;
}) {
  const [draft, setDraft] = useState<KycDraft>(() => readStored(cardKey)?.draft ?? defaultDraft());
  const [published, setPublished] = useState<KycDraft | null>(() => readStored(cardKey)?.published ?? null);
  const [error, setError] = useState('');
  const [footerNote, setFooterNote] = useState('Changes take effect when published.');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const stored = readStored(cardKey);
    setDraft(stored?.draft ?? defaultDraft());
    setPublished(stored?.published ?? null);
    setError('');
    setFooterNote('Changes take effect when published.');
    setReviewOpen(false);
  }, [cardKey]);

  useEffect(() => {
    if (!preview) return;
    const frame = requestAnimationFrame(() => setDrawerEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [preview]);

  const patch = useCallback((partial: Partial<KycDraft>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setError('');
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(published ?? null), [draft, published]);

  const status = !published
    ? draft.enabled
      ? 'Unpublished changes'
      : 'Off by default'
    : dirty
      ? 'Unpublished changes'
      : published.enabled
        ? 'Published'
        : 'Collection off';

  const businessSummary = contactLine(draft)
    ? `${merchantName || 'Merchant'} · ${contactLine(draft)}`
    : `${merchantName || 'Merchant'} · Add a phone number or email`;

  const closePreview = useCallback(() => {
    if (drawerClosing || !preview) return;
    setDrawerClosing(true);
    window.setTimeout(() => {
      setPreview(null);
      setDrawerEntered(false);
      setDrawerClosing(false);
    }, 300);
  }, [drawerClosing, preview]);

  const saveDraft = useCallback(() => {
    writeStored(cardKey, { draft, published });
    setFooterNote('Draft saved on this device. Not published.');
    setError('');
  }, [cardKey, draft, published]);

  const publish = useCallback(() => {
    if (publishing) return;
    const message = validatePublish(draft);
    if (message) {
      setError(message);
      setReviewOpen(true);
      if (draft.policyMode === 'template' && !draft.useRules.trim()) setRulesOpen(true);
      if (draft.policyMode === 'custom') setAdvancedOpen(true);
      return;
    }
    setPublishing(true);
    const next = { ...draft };
    void (async () => {
      writeStored(cardKey, { draft: next, published: next });
      setPublished(next);
      if (/^0x[0-9a-fA-F]{40}$/.test(cardKey)) {
        const saved = await updateBeamioCardShareMetadata({
          cardAddress: cardKey,
          shareTokenMetadata: {
            kyc: {
              enabled: next.enabled,
              fields: next.fields,
              entity: next.entity,
              contactPhone: next.phone,
              contactEmail: next.email,
              address: next.address,
              purposes: next.purposes,
              privacyNotice: next.customPrivacy,
              terms: next.customTerms,
            },
          } as never,
        });
        if (!saved.success) {
          setError(saved.error || 'Could not publish membership information settings.');
          setPublishing(false);
          return;
        }
      }
      setFooterNote('Published. The enrollment step uses these settings.');
      setError('');
      setPublishing(false);
    })();
  }, [cardKey, draft, publishing]);

  const previewText = preview === 'privacy' ? privacyDocument(draft, merchantName) : preview === 'terms' ? termsDocument(draft, merchantName) : '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1c1e21]">Member information collection</h1>
          <p className="mt-1 text-sm text-[#5f6368]">
            Choose which details to collect when customers join with their first top-up.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#eceff1] px-3 py-1 text-xs font-medium text-[#5f6368]">{status}</span>
      </header>

      <section className="rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#1c1e21]">Collect details at enrollment</h2>
            <p className="mt-1 text-sm text-[#5f6368]">Enable and publish to add a member details step before payment.</p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#1c1e21]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#bd303b]"
              checked={draft.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
            />
            Enable
          </label>
        </div>
      </section>

      {!draft.enabled ? (
        <section className="rounded-2xl border border-[#e6e8eb] bg-white p-5">
          <h2 className="text-base font-semibold text-[#1c1e21]">Keep the current top-up flow</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Customers go directly from choosing an amount to reviewing payment. Enabling collection only affects customers who have not yet completed enrollment.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[#e6e8eb] bg-white px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1c1e21]">01 · Information to collect</h2>
              <p className="mt-1 text-sm text-[#5f6368]">Only require information that is necessary to provide membership services.</p>
            </div>
            <div className="mt-2 divide-y divide-[#eef0f2]">
              <FieldCollectRow label="Full name" hint={FIELD_HINT.name} value={draft.fields.name} onChange={(name) => patch({ fields: { ...draft.fields, name } })} />
              <FieldCollectRow label="Phone number" hint={FIELD_HINT.phone} value={draft.fields.phone} onChange={(phone) => patch({ fields: { ...draft.fields, phone } })} />
              <FieldCollectRow label="Email" hint={FIELD_HINT.email} value={draft.fields.email} onChange={(email) => patch({ fields: { ...draft.fields, email } })} />
            </div>
            {requiredFields(draft).length ? (
              <div className="space-y-3 rounded-xl bg-[#f6f7f8] p-4">
                <p className="text-sm font-semibold text-[#1c1e21]">Purpose of required fields</p>
                <p className="text-xs text-[#6b7076]">
                  Choose a purpose only when the service genuinely depends on this information. Otherwise keep the field optional. No explanation to write.
                </p>
                {requiredFields(draft).map((key) => (
                  <label key={key} className="block">
                    <span className="text-sm font-medium text-[#1c1e21]">{FIELD_LABEL[key]}</span>
                    <span className="relative mt-2 block">
                      <select
                        className={selectClass}
                        value={draft.purposes[key]}
                        onChange={(event) => patch({ purposes: { ...draft.purposes, [key]: event.target.value } })}
                      >
                        {PURPOSE_OPTIONS[key].map((option) => (
                          <option key={option.value || 'empty'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7076]" aria-hidden />
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-[#e6e8eb] bg-white p-5">
            <div>
              <h2 className="text-base font-semibold text-[#1c1e21]">02 · Privacy & Membership Terms</h2>
              <p className="mt-1 text-sm text-[#5f6368]">Ready to review. No documents to write or upload.</p>
            </div>

            <label className={`block rounded-xl border p-4 ${draft.policyMode === 'template' ? 'border-[#f3c7cb] bg-[#fff6f6]' : 'border-[#e6e8eb]'}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-[#1c1e21]">
                <input
                  type="radio"
                  name="kyc-policy-mode"
                  className="accent-[#bd303b]"
                  checked={draft.policyMode === 'template'}
                  onChange={() => patch({ policyMode: 'template' })}
                />
                Generate policies from my settings
                <span className="rounded-full bg-[#e8eefc] px-2 py-0.5 text-[11px] font-semibold text-[#2457c5]">Recommended</span>
              </span>
              <span className="mt-1 block pl-6 text-sm text-[#5f6368]">
                Your business sets the rules. Beamio provides the technology and document-generation tools.
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 border-t border-[#eef0f2] pt-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1c1e21]">Business details</p>
                <p className="truncate text-sm text-[#5f6368]">{businessSummary}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-[#d8dce2] px-3 py-1.5 text-sm font-medium text-[#1c1e21]"
                onClick={() => setReviewOpen((open) => !open)}
              >
                Review details
              </button>
            </div>
            {reviewOpen ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[#1c1e21]">
                  Legal business name *
                  <input className={`${selectClass} mt-2 pr-3`} value={draft.entity} onChange={(event) => patch({ entity: event.target.value })} />
                </label>
                <p className="text-xs text-[#6b7076]">Provide at least one: phone or email.</p>
                <label className="block text-sm font-medium text-[#1c1e21]">
                  Phone (optional)
                  <input className={`${selectClass} mt-2 pr-3`} value={draft.phone} onChange={(event) => patch({ phone: event.target.value })} />
                </label>
                <label className="block text-sm font-medium text-[#1c1e21]">
                  Email (optional)
                  <input className={`${selectClass} mt-2 pr-3`} type="email" value={draft.email} onChange={(event) => patch({ email: event.target.value })} />
                </label>
                <label className="block text-sm font-medium text-[#1c1e21]">
                  Business mailing address *
                  <input className={`${selectClass} mt-2 pr-3`} value={draft.address} onChange={(event) => patch({ address: event.target.value })} />
                </label>
                <p className="text-xs text-[#6b7076]">Complete the missing details before publishing. No customer information is submitted from this page.</p>
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-[#1c1e21]">Collection purpose</span>
              <span className="relative mt-2 block">
                <select
                  className={selectClass}
                  value={draft.collectionPurpose}
                  onChange={(event) => patch({ collectionPurpose: event.target.value as CollectionPurpose })}
                >
                  <option value="profile">Create and manage member profiles</option>
                  <option value="service">Manage membership and provide customer support</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7076]" aria-hidden />
              </span>
            </label>

            <div className="rounded-xl bg-[#f6f7f8] p-4">
              <p className="text-sm font-semibold text-[#1c1e21]">Wallet identity & merchant access</p>
              <p className="mt-1 text-sm leading-relaxed text-[#5f6368]">
                Wallet addresses identify members on CoNET L1. Customers control their own private keys. Your business accesses its member information in Business OS using its own private key. Beamio provides technical tools and does not hold your private keys.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#1c1e21]">How member information is used</p>
                <span className="rounded-full bg-[#eceff1] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">Automatically generated</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5f6368]">{usageCopy(draft, merchantName)}</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  kind: 'privacy' as const,
                  title: `${merchantName || 'Merchant'} Privacy Notice`,
                  detail: 'Generated from your selected fields',
                },
                {
                  kind: 'terms' as const,
                  title: `${merchantName || 'Merchant'} Membership Terms`,
                  detail: 'Generated from your membership rules',
                },
              ].map((row) => (
                <div key={row.kind} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1c1e21]">{row.title}</p>
                    <p className="text-xs text-[#6b7076]">{row.detail}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-[#d8dce2] px-3 py-1.5 text-sm font-medium text-[#1c1e21]"
                    onClick={() => {
                      setDrawerClosing(false);
                      setDrawerEntered(false);
                      setPreview(row.kind);
                    }}
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-[#eef0f2] pt-3">
              <button type="button" className="text-sm font-semibold text-[#1c1e21]" onClick={() => setRulesOpen((open) => !open)}>
                Review membership rules
              </button>
              {rulesOpen ? (
                <div className="mt-3 space-y-3">
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Eligible locations
                    <input className={`${selectClass} mt-2 pr-3`} value={draft.locations} onChange={(event) => patch({ locations: event.target.value })} />
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Top-up refunds
                    <input className={`${selectClass} mt-2 pr-3`} value={draft.refunds} onChange={(event) => patch({ refunds: event.target.value })} />
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Credit expiry
                    <input className={`${selectClass} mt-2 pr-3`} value={draft.expiry} onChange={(event) => patch({ expiry: event.target.value })} />
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Use, exclusions, and transfer rules *
                    <input className={`${selectClass} mt-2 pr-3`} value={draft.useRules} onChange={(event) => patch({ useRules: event.target.value })} />
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Fees *
                    <input className={`${selectClass} mt-2 pr-3`} value={draft.fees} onChange={(event) => patch({ fees: event.target.value })} />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#eef0f2] pt-3">
              <button type="button" className="text-sm font-semibold text-[#1c1e21]" onClick={() => setAdvancedOpen((open) => !open)}>
                Advanced · Use my own policies
              </button>
              {advancedOpen ? (
                <div className="mt-3 space-y-3">
                  <label className={`block rounded-xl border p-4 ${draft.policyMode === 'custom' ? 'border-[#f3c7cb] bg-[#fff6f6]' : 'border-[#e6e8eb]'}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#1c1e21]">
                      <input
                        type="radio"
                        name="kyc-policy-mode"
                        className="accent-[#bd303b]"
                        checked={draft.policyMode === 'custom'}
                        onChange={() => patch({ policyMode: 'custom' })}
                      />
                      Use my own policies
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Privacy Notice *
                    <textarea
                      className={`${selectClass} mt-2 min-h-28 pr-3`}
                      value={draft.customPrivacy}
                      onChange={(event) => patch({ customPrivacy: event.target.value, policyMode: 'custom' })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#1c1e21]">
                    Membership Terms *
                    <textarea
                      className={`${selectClass} mt-2 min-h-28 pr-3`}
                      value={draft.customTerms}
                      onChange={(event) => patch({ customTerms: event.target.value, policyMode: 'custom' })}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm text-[#1c1e21]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#bd303b]"
                checked={draft.approved}
                onChange={(event) => patch({ approved: event.target.checked })}
              />
              I have reviewed and approved these policies for my business.
            </label>
          </section>

          <section className="rounded-2xl border border-[#e6e8eb] bg-white p-5">
            <h2 className="text-base font-semibold text-[#1c1e21]">03 · Marketing preferences</h2>
            <p className="mt-1 text-sm text-[#5f6368]">Optional, separate consent. Declining does not affect membership or top-ups.</p>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-[#1c1e21]">
              Show opt-in options
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1562f0]"
                checked={draft.marketing}
                onChange={(event) => patch({ marketing: event.target.checked })}
              />
            </label>
            {draft.marketing ? (
              <label className="mt-4 block text-sm font-medium text-[#1c1e21]">
                Sender mailing address *
                <input className={`${selectClass} mt-2 pr-3`} value={draft.mailingAddress} onChange={(event) => patch({ mailingAddress: event.target.value })} />
                <span className="mt-2 block text-xs font-normal text-[#6b7076]">
                  Only show options for contact fields you collect. Email and SMS require separate, unchecked opt-ins. Customers can unsubscribe anytime.
                </span>
              </label>
            ) : null}
          </section>
        </>
      )}

      {error ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-sm text-[#5f6368]">{footerNote}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[#d8dce2] bg-white px-4 py-2 text-sm font-semibold text-[#1c1e21]"
            onClick={saveDraft}
          >
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[#1562f0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={publishing}
            aria-busy={publishing}
            onClick={publish}
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            Confirm & Publish
          </button>
        </div>
      </footer>

      {preview ? (
        <div className="fixed inset-0 z-[80]">
          <button type="button" aria-label="Close preview" className="absolute inset-0 bg-black/30" onClick={closePreview} />
          <aside
            className="absolute inset-y-0 right-0 flex w-full max-w-[540px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
            style={{ transform: drawerClosing || !drawerEntered ? 'translateX(100%)' : 'translateX(0)' }}
          >
            <div className="flex items-center justify-between border-b border-[#eef0f2] px-5 py-4">
              <h2 className="text-base font-semibold text-[#1c1e21]">{preview === 'privacy' ? 'Privacy Notice' : 'Membership Terms'}</h2>
              <button type="button" className="text-sm font-semibold text-[#1562f0]" onClick={closePreview}>
                Close
              </button>
            </div>
            <pre className="flex-1 overflow-y-auto whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-relaxed text-[#1c1e21]">{previewText}</pre>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
