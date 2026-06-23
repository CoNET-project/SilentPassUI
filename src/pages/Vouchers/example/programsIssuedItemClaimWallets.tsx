import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { IpfsImg } from '@/components/IpfsImg';
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider';
import type { IssuedNftClaimWalletApiRow } from '@/services/BeamioCard';
import { useTu } from '@/locale/beamioLocale';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

function formatClaimWalletDate(iso: string | undefined): string {
  if (!iso?.trim()) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayNameFromCapsule(item: {
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  accountName?: string;
  username?: string;
}): string {
  const first = (item.first_name ?? item.firstName ?? '').trim();
  let last = (item.last_name ?? item.lastName ?? '').trim();
  if (last.includes('\r\n')) last = last.split('\r\n')[0]?.trim() ?? '';
  if (last.startsWith('{')) last = '';
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  const tag = (item.accountName ?? item.username ?? '').trim();
  return fullName || tag || '';
}

function ClaimWalletBeamioCapsule({
  wallet,
  className = '',
}: {
  wallet: string;
  className?: string;
}) {
  const { toCapsuleItem, avatarImgUrl, resolveTag } = useBeamioTagDatabase();
  const item = toCapsuleItem(wallet);
  const tag = item ? (item.accountName ?? item.username) : undefined;
  const beamioTag = tag ? `@${tag.replace(/^@+/, '')}` : resolveTag(wallet) || '@Beamio';
  const name = item ? displayNameFromCapsule(item) : '';

  return (
    <div className={`inline-flex max-w-full min-w-0 items-center gap-2 ${className}`}>
      <IpfsImg
        src={item?.image ? item.image : avatarImgUrl(tag, wallet)}
        alt={beamioTag}
        className="h-8 w-8 shrink-0 rounded-full border border-[#abadaf]/40 object-cover"
      />
      <div className="flex min-w-0 flex-col items-start">
        {name ? (
          <span className="max-w-full truncate text-[12px] font-semibold leading-tight text-[#2c2f31]">
            {name}
          </span>
        ) : null}
        <span className="max-w-full truncate text-[11px] font-medium leading-tight text-[#0051d1]">
          {beamioTag.startsWith('@') ? beamioTag : `@${beamioTag}`}
        </span>
      </div>
    </div>
  );
}

export type ProgramsIssuedItemClaimWalletsTheme = 'programs' | 'catalog';

export type ProgramsIssuedItemClaimWalletsView = {
  items: IssuedNftClaimWalletApiRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
};

export type ProgramsIssuedItemClaimWalletsSectionProps = {
  theme: ProgramsIssuedItemClaimWalletsTheme;
  mintedCount?: string;
  view: ProgramsIssuedItemClaimWalletsView;
  onPageChange: (page: number) => void;
  onRequestLoad: (page: number) => void;
};

export function ProgramsIssuedItemClaimWalletsSection(props: ProgramsIssuedItemClaimWalletsSectionProps) {
  const { theme, mintedCount, view, onPageChange, onRequestLoad } = props;
  const { tu } = useTu();
  const { ensureProfilesForAddresses } = useBeamioTagDatabase();
  const mintedN = Number.parseInt(String(mintedCount ?? '').replace(/,/g, '').trim(), 10);
  const hasMinted = Number.isFinite(mintedN) && mintedN > 0;

  const walletAddresses = useMemo(
    () =>
      view.items
        .flatMap((row) => [row.wallet, row.holder].filter((a) => a && a.length >= 10))
        .filter((a, i, arr) => arr.indexOf(a) === i),
    [view.items]
  );

  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (!hasMinted) {
      initialLoadDoneRef.current = false;
      return;
    }
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    onRequestLoad(1);
  }, [hasMinted, onRequestLoad]);

  useEffect(() => {
    if (walletAddresses.length === 0) return;
    void ensureProfilesForAddresses(walletAddresses, { maxPerTick: walletAddresses.length });
  }, [walletAddresses, ensureProfilesForAddresses]);

  const pageCount = Math.max(1, Math.ceil(view.total / Math.max(1, view.pageSize)));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const borderClass = theme === 'catalog' ? 'border-[#ea580c]/10' : 'border-[#1562f0]/10';
  const headerBg = theme === 'catalog' ? 'bg-[#fff7ed]' : 'bg-[#f0f4fb]';
  const accentText = theme === 'catalog' ? 'text-[#ea580c]' : 'text-[#1562f0]';
  const focusRing =
    theme === 'catalog'
      ? 'focus-visible:ring-[#ea580c]/40'
      : 'focus-visible:ring-[#1562f0]/40';

  if (!hasMinted) {
    return (
      <div className={`border-t ${borderClass} bg-white/70 px-3 py-3 sm:px-4 sm:py-3.5`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#595c5e]">{tu('programs_claim_wallets_title')}</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#747779]">
          {tu('programs_claim_wallets_no_claims_yet')}
        </p>
      </div>
    );
  }

  return (
    <div className={`border-t ${borderClass} bg-white/70 px-3 py-3 sm:px-4 sm:py-3.5`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#595c5e]">{tu('programs_claim_wallets_title')}</p>
        {view.loading ? <Loader2 className={`h-3.5 w-3.5 animate-spin ${accentText}`} aria-hidden /> : null}
      </div>
      {view.error && view.items.length === 0 ? (
        <p className="text-[11px] font-medium leading-relaxed text-amber-700">{view.error}</p>
      ) : view.items.length === 0 && !view.loading ? (
        <p className="text-[11px] font-medium leading-relaxed text-[#747779]">
          {tu('programs_claim_wallets_not_found')}
        </p>
      ) : (
        <>
          <div className={`overflow-x-auto rounded-lg border ${borderClass}`}>
            <table className="min-w-full text-left text-[11px]">
              <thead className={`${headerBg} text-[9px] font-bold uppercase tracking-wider text-[#595c5e]`}>
                <tr>
                  <th className="px-2.5 py-2 sm:px-3">{tu('programs_claim_wallets_claimed_col')}</th>
                  <th className="px-2.5 py-2 sm:px-3">{tu('programs_claim_wallets_member')}</th>
                  <th className="px-2.5 py-2 sm:px-3">{tu('programs_claim_wallets_burned')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} bg-white`}>
                {view.items.map((row) => (
                  <tr key={`${row.wallet}-${row.txHash}`}>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[#595c5e] sm:px-3">
                      {formatClaimWalletDate(row.claimedAt)}
                    </td>
                    <td className="px-2.5 py-2 sm:px-3">
                      <ClaimWalletBeamioCapsule wallet={row.wallet} />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[#595c5e] sm:px-3">
                      {formatClaimWalletDate(row.burnedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.total > view.pageSize ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={page <= 1 || view.loading}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={`inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold text-[#2c2f31] disabled:cursor-not-allowed disabled:opacity-40 ${borderClass} ${bizFocusRingClass} ${focusRing}`}
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {tu('programs_table_previous')}
              </button>
              <span className="text-[10px] font-semibold text-[#595c5e]">
                {tu('programs_table_page_of', { page, total: pageCount })}
                <span className="text-[#747779]">
                  {' '}
                  ·{' '}
                  {tu('programs_table_page_range', {
                    from: (page - 1) * view.pageSize + 1,
                    to: Math.min(page * view.pageSize, view.total),
                    total: view.total.toLocaleString(),
                  })}
                </span>
              </span>
              <button
                type="button"
                disabled={page >= pageCount || view.loading}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                className={`inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold text-[#2c2f31] disabled:cursor-not-allowed disabled:opacity-40 ${borderClass} ${bizFocusRingClass} ${focusRing}`}
              >{tu('next')}<ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
      {view.error && view.items.length > 0 ? (
        <p className="mt-2 text-[10px] font-medium text-amber-700">{tu('programs_claim_wallets_refresh_failed')}</p>
      ) : null}
    </div>
  );
}
