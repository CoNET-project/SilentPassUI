import type { CardMetadataFromUri } from '@/services/BeamioCard'

export type LegacyCardMigrationStatus =
  | 'migrated'
  | 'legacy-review'
  | 'legacy-ambiguous'

export type LegacyCardMigrationAudit = {
  status: LegacyCardMigrationStatus
  reason: string
  cardAddress: string
  tierCount: number
  metadataTierCount: number
  hasMembershipSchedule: boolean
  hasQualificationMode: boolean
}

type AuditMetadata = CardMetadataFromUri & {
  tierQualificationMode?: unknown
  tierMigration?: { status?: unknown }
}

/**
 * Read-only guard for existing cards.
 *
 * Existing cards must never be silently rewritten from /home: setTiers replaces
 * the complete array and can invalidate the meaning of already-issued slots.
 * Only cards with an explicit migration marker are considered migrated. All
 * other cards enter the merchant's review/configuration flow.
 */
export function auditLegacyCardMigration(input: {
  cardAddress: string
  metadata: CardMetadataFromUri | null | undefined
  upgradeType: number
  chainTierCount?: number | null
  membershipFeeCount?: number | null
}): LegacyCardMigrationAudit {
  const metadata = (input.metadata ?? {}) as AuditMetadata
  const metadataTierCount = Array.isArray(metadata.tiers) ? metadata.tiers.length : 0
  const tierCount = Number.isFinite(input.chainTierCount) ? Math.max(0, Number(input.chainTierCount)) : 0
  const membershipFeeCount = Number.isFinite(input.membershipFeeCount)
    ? Math.max(0, Number(input.membershipFeeCount))
    : 0
  const hasQualificationMode =
    metadata.tierQualificationMode === 0 ||
    metadata.tierQualificationMode === 1 ||
    metadata.tierQualificationMode === 2
  const hasMembershipSchedule = membershipFeeCount > 0 || Boolean(metadata.baseMembership)
  const explicitlyMigrated = metadata.tierMigration?.status === 'migrated'

  if (explicitlyMigrated) {
    return {
      status: 'migrated',
      reason: 'This card already has the canonical tier configuration.',
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      hasMembershipSchedule,
      hasQualificationMode,
    }
  }

  if (!input.metadata || tierCount === 0 || (metadataTierCount > 0 && tierCount !== metadataTierCount)) {
    return {
      status: 'legacy-ambiguous',
      reason: 'The card metadata and on-chain tier slots do not provide a safe one-to-one migration.',
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      hasMembershipSchedule,
      hasQualificationMode,
    }
  }

  return {
    status: 'legacy-review',
    reason:
      input.upgradeType < 0
        ? 'The card is legacy and its on-chain qualification mode still needs confirmation.'
        : 'The card is legacy and requires explicit owner review before tier migration.',
    cardAddress: input.cardAddress,
    tierCount,
    metadataTierCount,
    hasMembershipSchedule,
    hasQualificationMode,
  }
}
