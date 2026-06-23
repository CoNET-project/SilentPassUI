import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useTu } from '@/locale/beamioLocale';
import { useReliableTapHandler } from '../../../utils/reliableTap';

export type CardConfiguratorMobileChromeProps = {
  step: number;
  totalSteps: number;
  onTopBack: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  showPrimaryChevron?: boolean;
  /**
   * `market` — `marketExample.html`: back | centered title + step pill | trailing brand (e.g. program name).
   * `default` — back + title left, step counter on the right.
   */
  headerLayout?: 'default' | 'market';
  /** Shown in top-right when `headerLayout === 'market'` (truncate). */
  trailingBrandLabel?: string;
  /** When false, hides the top-left back control (e.g. step 1 “Define your brand”). */
  showTopBack?: boolean;
};

/** Touch-safe CTA: avoids sticky :hover on mobile and removes 300ms tap delay. */
export const CARD_SETUP_MOBILE_CTA_TOUCH_CLASS =
  'touch-manipulation select-none [-webkit-tap-highlight-color:transparent]';

const CARD_SETUP_FIXED_CHROME_Z_CLASS = 'z-[100]';

function CardConfiguratorMobileBodyPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

/**
 * Fixed top bar + fixed bottom action bar for Card Configurator on small viewports.
 * Portaled to `document.body` so taps are not swallowed by the main scroll container.
 */
export function CardConfiguratorMobileChrome({
  step,
  totalSteps,
  onTopBack,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  showPrimaryChevron = true,
  headerLayout = 'default',
  trailingBrandLabel = 'Verra',
  showTopBack = true,
}: CardConfiguratorMobileChromeProps) {
  const { tu } = useTu();
  const brand = (trailingBrandLabel ?? 'Verra').trim() || 'Verra';
  const backTap = useReliableTapHandler(onTopBack);
  const primaryTap = useReliableTapHandler(() => {
    if (primaryDisabled) return;
    onPrimary();
  });

  return (
    <CardConfiguratorMobileBodyPortal>
      {headerLayout === 'market' ? (
        <header
          className={`fixed left-0 right-0 top-0 ${CARD_SETUP_FIXED_CHROME_Z_CLASS} bg-white/70 pt-[env(safe-area-inset-top,0px)] shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl`}
        >
          <div className="flex w-full items-center justify-between px-4 py-3">
            {showTopBack ? (
              <button
                type="button"
                data-touch-priority="1"
                {...backTap}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0051d1] transition-transform active:scale-95 active:opacity-80 ${CARD_SETUP_MOBILE_CTA_TOUCH_CLASS}`}
                aria-label={tu('programs_mobile_go_back')}
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            ) : (
              <div className="h-9 w-9 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center px-2">
              <h1 className="font-manrope text-center text-sm font-bold tracking-tight text-[#2c2f31]">
                {tu('programs_mobile_card_setup')}
              </h1>
              <span className="font-manrope text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0051d1]">
                {tu('programs_mobile_step_of', { step, total: totalSteps })}
              </span>
            </div>
            <div
              className="max-w-[4.5rem] shrink-0 text-right font-manrope text-xs font-black text-[#0051d1] sm:max-w-[6rem]"
              title={brand}
            >
              <span className="block truncate">{brand}</span>
            </div>
          </div>
        </header>
      ) : (
        <header
          className={`fixed left-0 right-0 top-0 ${CARD_SETUP_FIXED_CHROME_Z_CLASS} flex items-center justify-between bg-white/70 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] shadow-[0_20px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showTopBack ? (
              <button
                type="button"
                data-touch-priority="1"
                {...backTap}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0051d1] transition-transform active:scale-95 active:opacity-80 ${CARD_SETUP_MOBILE_CTA_TOUCH_CLASS}`}
                aria-label={tu('programs_mobile_go_back')}
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <h1 className="font-manrope min-w-0 truncate text-base font-bold tracking-tight text-[#2c2f31]">
              {tu('programs_mobile_card_setup')}
            </h1>
          </div>
          <div className="shrink-0 font-manrope text-[10px] font-semibold uppercase tracking-widest text-[#595c5e]">
            {tu('programs_mobile_step_of', { step, total: totalSteps })}
          </div>
        </header>
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 ${CARD_SETUP_FIXED_CHROME_Z_CLASS} flex justify-center bg-white/70 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(21,98,240,0.06)] backdrop-blur-xl ${
          headerLayout === 'market' ? 'pt-3' : 'pt-4'
        }`}
      >
        <div className="flex w-full max-w-6xl items-center justify-center gap-2 px-1">
          <button
            type="button"
            data-touch-priority="1"
            {...primaryTap}
            disabled={primaryDisabled}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#0051d1] px-5 font-bold text-white shadow-[0_10px_30px_rgba(0,81,209,0.3)] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-md sm:flex-initial sm:px-10 ${CARD_SETUP_MOBILE_CTA_TOUCH_CLASS} ${
              headerLayout === 'market' ? 'min-h-[44px] py-2.5 text-xs' : 'min-h-[48px] py-3 text-sm'
            }`}
          >
            <span className="truncate">{primaryLabel}</span>
            {showPrimaryChevron ? (
              <ChevronRight className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
            ) : null}
          </button>
        </div>
      </div>
    </CardConfiguratorMobileBodyPortal>
  );
}

/** Portals a fixed bottom CTA bar outside the scroll container (Ket welcome, etc.). */
export function CardConfiguratorMobileFixedFooterPortal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CardConfiguratorMobileBodyPortal>
      <div
        className={`fixed bottom-0 left-0 right-0 ${CARD_SETUP_FIXED_CHROME_Z_CLASS} ${className}`}
      >
        {children}
      </div>
    </CardConfiguratorMobileBodyPortal>
  );
}

/**
 * Page canvas for Card Configurator Review step — matches `marketExample.html` Tailwind `surface` / `background`.
 */
export const CARD_CONFIGURATOR_REVIEW_SURFACE_CLASS = 'bg-[#f5f7f9]';

/**
 * Matches `marketExample.html` `.editorial-shadow` (summary cards, hero card).
 */
export const CARD_CONFIGURATOR_REVIEW_EDITORIAL_SHADOW_CLASS =
  'shadow-[0_20px_40px_rgba(21,98,240,0.06)]';

/** Top padding below fixed header; bottom padding above fixed footer (incl. notch / status bar). */
export const CARD_CONFIGURATOR_MOBILE_MAIN_PAD =
  'pt-[calc(88px+env(safe-area-inset-top,0px))] pb-[120px]';

/** Taller top pad when using `headerLayout="market"` (two-line center block). */
export const CARD_CONFIGURATOR_MOBILE_MAIN_PAD_MARKET_HEADER =
  'pt-[calc(78px+env(safe-area-inset-top,0px))] pb-[100px]';

/**
 * `sticky` offset below fixed header (step ≥2 uses market header — keep in sync with MAIN_PAD_MARKET).
 */
export const CARD_CONFIGURATOR_MOBILE_STICKY_BELOW_HEADER_CLASS =
  'top-[calc(78px+env(safe-area-inset-top,0px))]';
