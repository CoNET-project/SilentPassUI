import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Info,
  Megaphone,
  Ticket,
} from 'lucide-react';

export const PROGRAM_TAB_BASIC = 'Program Basic Info';
export const PROGRAM_TAB_PROMOTION = 'Program Promotion';
export const PROGRAM_TAB_VOUCHERS = 'Program Vouchers';
export const PROGRAM_TAB_BUSINESS = 'Program Business';

export const PROGRAM_TABS = [
  PROGRAM_TAB_BASIC,
  PROGRAM_TAB_PROMOTION,
  PROGRAM_TAB_VOUCHERS,
  PROGRAM_TAB_BUSINESS,
] as const;

export type ProgramTabId = (typeof PROGRAM_TABS)[number];

export type ProgramMenuSection = 'basic' | 'promotion' | 'vouchers' | 'business';

export const PROGRAM_ROUTE_BASIC = '/Program/Basic';
export const PROGRAM_ROUTE_PROMOTION = '/Program/Promotion';
export const PROGRAM_ROUTE_VOUCHERS = '/Program/Vouchers';
export const PROGRAM_ROUTE_BUSINESS = '/Program/Business';

const LEGACY_PROGRAM_TAB = 'Card Issuance Setup';
const LEGACY_BUSINESS_TAB = 'Business';

export function normalizeProgramTab(tab: string): ProgramTabId | null {
  switch (tab) {
    case PROGRAM_TAB_BASIC:
    case LEGACY_PROGRAM_TAB:
      return PROGRAM_TAB_BASIC;
    case PROGRAM_TAB_PROMOTION:
      return PROGRAM_TAB_PROMOTION;
    case PROGRAM_TAB_VOUCHERS:
      return PROGRAM_TAB_VOUCHERS;
    case PROGRAM_TAB_BUSINESS:
    case LEGACY_BUSINESS_TAB:
      return PROGRAM_TAB_BUSINESS;
    default:
      return null;
  }
}

export function programSectionFromTab(tab: string): ProgramMenuSection | null {
  switch (normalizeProgramTab(tab)) {
    case PROGRAM_TAB_BASIC:
      return 'basic';
    case PROGRAM_TAB_PROMOTION:
      return 'promotion';
    case PROGRAM_TAB_VOUCHERS:
      return 'vouchers';
    case PROGRAM_TAB_BUSINESS:
      return 'business';
    default:
      return null;
  }
}

export function isProgramAreaTab(tab: string): boolean {
  return programSectionFromTab(tab) != null;
}

export function programTabFromPath(pathname: string): ProgramTabId | null {
  if (pathname === '/Business' || pathname.endsWith('/Business')) return PROGRAM_TAB_BUSINESS;
  if (pathname.endsWith('/Program/Promotion')) return PROGRAM_TAB_PROMOTION;
  if (pathname.endsWith('/Program/Vouchers')) return PROGRAM_TAB_VOUCHERS;
  if (pathname.endsWith('/Program/Business')) return PROGRAM_TAB_BUSINESS;
  if (pathname.endsWith('/Program/Basic') || pathname.endsWith('/Program')) return PROGRAM_TAB_BASIC;
  return null;
}

export function programPathFromTab(tab: string): string {
  switch (normalizeProgramTab(tab)) {
    case PROGRAM_TAB_PROMOTION:
      return PROGRAM_ROUTE_PROMOTION;
    case PROGRAM_TAB_VOUCHERS:
      return PROGRAM_ROUTE_VOUCHERS;
    case PROGRAM_TAB_BUSINESS:
      return PROGRAM_ROUTE_BUSINESS;
    case PROGRAM_TAB_BASIC:
      return PROGRAM_ROUTE_BASIC;
    default:
      return PROGRAM_ROUTE_BASIC;
  }
}

export function programMenuTitleKey(tab: string): string {
  switch (normalizeProgramTab(tab)) {
    case PROGRAM_TAB_PROMOTION:
      return 'program_menu_promotion';
    case PROGRAM_TAB_VOUCHERS:
      return 'program_menu_vouchers';
    case PROGRAM_TAB_BUSINESS:
      return 'program_menu_business';
    case PROGRAM_TAB_BASIC:
    default:
      return 'program_menu_basic';
  }
}

type ProgramSubItem = {
  tab: ProgramTabId;
  labelKey: string;
  icon: LucideIcon;
};

const PROGRAM_SUB_ITEMS: ProgramSubItem[] = [
  { tab: PROGRAM_TAB_BASIC, labelKey: 'program_menu_basic', icon: Info },
  { tab: PROGRAM_TAB_PROMOTION, labelKey: 'program_menu_promotion', icon: Megaphone },
  { tab: PROGRAM_TAB_VOUCHERS, labelKey: 'program_menu_vouchers', icon: Ticket },
  { tab: PROGRAM_TAB_BUSINESS, labelKey: 'program_menu_business', icon: Briefcase },
];

type NavProgramMenuProps = {
  activeTab: string;
  collapsed: boolean;
  tu: (key: string, options?: Record<string, unknown>) => string;
  onSelect: (tab: ProgramTabId) => void;
  focusRingClass: string;
};

/** Inline Programs nav: sub-items expand below Programs in the same sidebar (no flyout popup). */
export function NavProgramMenu({
  activeTab,
  collapsed,
  tu,
  onSelect,
  focusRingClass,
}: NavProgramMenuProps) {
  const activeProgramTab = normalizeProgramTab(activeTab);
  const programAreaActive = activeProgramTab != null;
  const [expanded, setExpanded] = useState(programAreaActive);

  useEffect(() => {
    if (programAreaActive) setExpanded(true);
  }, [programAreaActive]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="mx-2 flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="biz-program-submenu"
        onClick={toggleExpanded}
        className={`flex min-w-0 items-center rounded-full py-2.5 text-sm transition-all duration-300 ${
          collapsed ? 'w-[calc(100%-1rem)] justify-center px-0' : 'w-[calc(100%-1rem)] gap-2.5 px-4'
        } ${
          programAreaActive
            ? 'bg-white font-bold text-[#0051d1] shadow-sm'
            : 'font-medium text-slate-600 hover:translate-x-1 hover:bg-slate-200/50'
        } ${focusRingClass}`}
        title={collapsed ? tu('programs') : undefined}
      >
        <Award
          size={20}
          strokeWidth={programAreaActive ? 2.25 : 2}
          className={`shrink-0 ${programAreaActive ? 'text-[#0051d1]' : 'text-slate-600'}`}
        />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{tu('programs')}</span>
            {expanded ? (
              <ChevronDown size={16} className="shrink-0 text-slate-400" aria-hidden />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
            )}
          </>
        ) : null}
      </button>

      {expanded ? (
        <div
          id="biz-program-submenu"
          role="group"
          aria-label={tu('programs')}
          className={`flex flex-col gap-0.5 ${collapsed ? 'items-center' : 'ml-3 border-l border-slate-200/90 pl-2'}`}
        >
          {PROGRAM_SUB_ITEMS.map(({ tab, labelKey, icon: Icon }) => {
            const isActive = activeProgramTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSelect(tab)}
                title={collapsed ? tu(labelKey) : undefined}
                className={`flex min-w-0 items-center rounded-full text-sm transition-all duration-300 ${
                  collapsed
                    ? 'h-9 w-9 justify-center'
                    : 'w-[calc(100%-0.25rem)] gap-2.5 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-[#0051d1]/10 font-bold text-[#0051d1]'
                    : 'font-medium text-slate-600 hover:bg-slate-200/50'
                } ${focusRingClass}`}
              >
                <Icon
                  size={collapsed ? 18 : 17}
                  strokeWidth={isActive ? 2.25 : 2}
                  className={`shrink-0 ${isActive ? 'text-[#0051d1]' : 'text-slate-500'}`}
                />
                {!collapsed ? <span className="min-w-0 truncate text-left">{tu(labelKey)}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use NavProgramMenu — kept as alias for imports during transition. */
export const NavProgramFlyout = NavProgramMenu;
