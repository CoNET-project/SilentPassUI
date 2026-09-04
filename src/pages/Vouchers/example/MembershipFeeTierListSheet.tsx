/**
 * Programs → Loyalty Logic → Membership Fee tier list.
 * Opens first; row tap / Add tier then opens MembershipFeeTierProgramEditor.
 */
import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Crown, Plus, X } from 'lucide-react'

export type MembershipFeeTierListItem = {
  id: string
  name: string
  feeLabel: string
  durationLabel: string
  isBase: boolean
  feeLocked: boolean
  color: string
}

export type MembershipFeeTierListSheetProps = {
  open: boolean
  items: MembershipFeeTierListItem[]
  listError: string
  canAddHigher: boolean
  focusRingClassName?: string
  tu: (key: string, vars?: Record<string, string | number>) => string
  onClose: () => void
  onSelectTier: (tierId: string) => void
  onAddTier: () => void
}

export function MembershipFeeTierListSheet({
  open,
  items,
  listError,
  canAddHigher,
  focusRingClassName = '',
  tu,
  onClose,
  onSelectTier,
  onAddTier,
}: MembershipFeeTierListSheetProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={tu('programs_membership_fee_tier_list_close_aria')}
            className="fixed inset-0 z-[88] bg-[#2c2f31]/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-membership-fee-tier-list-title"
            className="fixed inset-x-0 bottom-0 z-[89] mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-24px_64px_rgba(0,0,0,0.12)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="shrink-0 px-6 pt-6">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#d9dde0]" aria-hidden />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="rounded-full bg-[#0051d1]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0051d1]">
                    {tu('programs_membership_fee_tier_editor_badge')}
                  </span>
                  <h3
                    id="card-membership-fee-tier-list-title"
                    className="mt-3 font-manrope text-2xl font-extrabold tracking-tight text-[#2c2f31] sm:text-3xl"
                  >
                    {tu('programs_membership_fee_tier_list_title')}
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#595c5e]">
                    {tu('programs_membership_fee_tier_list_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={tu('programs_membership_fee_tier_list_close_aria')}
                  onClick={onClose}
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eeedf3] text-[#2c2f31] transition hover:bg-[#e4e2ea] ${focusRingClassName}`}
                >
                  <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
              {listError ? (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                >
                  {listError}
                </div>
              ) : null}

              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTier(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border border-[#e8ecf0] bg-[#f8f9fb] px-3 py-3 text-left transition hover:bg-[#f1f3f7] ${focusRingClassName}`}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      >
                        <Crown className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-[#1a1b1f]">
                            {item.name}
                          </span>
                          {item.isBase ? (
                            <span className="rounded-full bg-[#0051d1]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0051d1]">
                              {tu('programs_membership_fee_tier_list_base_badge')}
                            </span>
                          ) : null}
                          {item.feeLocked ? (
                            <span className="rounded-full bg-[#eeedf3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#595c5e]">
                              {tu('programs_membership_fee_tier_locked')}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-[#595c5e]">
                          {item.feeLabel}
                          {item.durationLabel ? ` · ${item.durationLabel}` : ''}
                        </span>
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-[#424655]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={onAddTier}
                disabled={!canAddHigher}
                title={
                  canAddHigher
                    ? undefined
                    : tu('programs_membership_fee_tier_list_add_requires_base')
                }
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#c5cad3] bg-white px-3 py-3 text-[15px] font-semibold text-[#0051d1] transition hover:border-[#0051d1]/40 hover:bg-[#0051d1]/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#c5cad3] disabled:hover:bg-white ${focusRingClassName}`}
              >
                <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                {tu('programs_membership_fee_tier_list_add')}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
