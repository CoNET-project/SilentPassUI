import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Loader2 } from 'lucide-react';
import type { IssuedNftClaimWalletApiRow } from '@/services/BeamioCard';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

function fmtAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ClaimWalletAddressCapsule({
  address,
  className = '',
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!address || address.length < 10) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [address]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors sm:text-[11px] ${className} ${bizFocusRingClass}`}
      title="Copy wallet address"
      aria-label={`Copy wallet address ${address}`}
    >
      <span className="truncate">{fmtAddr(address)}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

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
  const mintedN = Number.parseInt(String(mintedCount ?? '').replace(/,/g, '').trim(), 10);
  const hasMinted = Number.isFinite(mintedN) && mintedN > 0;

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

  const pageCount = Math.max(1, Math.ceil(view.total / Math.max(1, view.pageSize)));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const borderClass = theme === 'catalog' ? 'border-[#ea580c]/10' : 'border-[#1562f0]/10';
  const headerBg = theme === 'catalog' ? 'bg-[#fff7ed]' : 'bg-[#f0f4fb]';
  const accentText = theme === 'catalog' ? 'text-[#ea580c]' : 'text-[#1562f0]';
  const capsuleClass =
    theme === 'catalog'
      ? 'border-[#ea580c]/15 bg-white text-[#2c2f31]'
      : 'border-[#1562f0]/15 bg-white text-[#2c2f31]';
  const focusRing =
    theme === 'catalog'
      ? 'focus-visible:ring-[#ea580c]/40'
      : 'focus-visible:ring-[#1562f0]/40';

  if (!hasMinted) {
    return (
      <div className={`border-t ${borderClass} bg-white/70 px-3 py-3 sm:px-4 sm:py-3.5`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#595c5e]">Claimed wallets</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#747779]">
          No claims yet. Wallets appear here after members complete an open claim or redeem this item.
        </p>
      </div>
    );
  }

  return (
    <div className={`border-t ${borderClass} bg-white/70 px-3 py-3 sm:px-4 sm:py-3.5`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#595c5e]">Claimed wallets</p>
        {view.loading ? <Loader2 className={`h-3.5 w-3.5 animate-spin ${accentText}`} aria-hidden /> : null}
      </div>
      {view.error && view.items.length === 0 ? (
        <p className="text-[11px] font-medium leading-relaxed text-amber-700">{view.error}</p>
      ) : view.items.length === 0 && !view.loading ? (
        <p className="text-[11px] font-medium leading-relaxed text-[#747779]">
          No claim wallets found for this item yet.
        </p>
      ) : (
        <>
          <div className={`overflow-x-auto rounded-lg border ${borderClass}`}>
            <table className="min-w-full text-left text-[11px]">
              <thead className={`${headerBg} text-[9px] font-bold uppercase tracking-wider text-[#595c5e]`}>
                <tr>
                  <th className="px-2.5 py-2 sm:px-3">Wallet</th>
                  <th className="px-2.5 py-2 sm:px-3">Claimed</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderClass} bg-white`}>
                {view.items.map((row) => (
                  <tr key={`${row.wallet}-${row.txHash}`}>
                    <td className="px-2.5 py-2 sm:px-3">
                      <ClaimWalletAddressCapsule address={row.wallet} className={capsuleClass} />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[#595c5e] sm:px-3">
                      {formatClaimWalletDate(row.claimedAt)}
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
                Previous
              </button>
              <span className="text-[10px] font-semibold text-[#595c5e]">
                Page {page} of {pageCount}
                <span className="text-[#747779]">
                  {' '}
                  · {(page - 1) * view.pageSize + 1}–{Math.min(page * view.pageSize, view.total)} of{' '}
                  {view.total.toLocaleString()}
                </span>
              </span>
              <button
                type="button"
                disabled={page >= pageCount || view.loading}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                className={`inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[10px] font-bold text-[#2c2f31] disabled:cursor-not-allowed disabled:opacity-40 ${borderClass} ${bizFocusRingClass} ${focusRing}`}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
      {view.error && view.items.length > 0 ? (
        <p className="mt-2 text-[10px] font-medium text-amber-700">Refresh failed — showing last loaded wallets.</p>
      ) : null}
    </div>
  );
}
