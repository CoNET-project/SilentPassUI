import type { CardMetadataFromUri } from "@/services/BeamioCard";

export type LegacyCardMigrationStatus =
  | "migrated"
  | "legacy-review"
  | "legacy-ambiguous";

export type LegacyCardMigrationAudit = {
  status: LegacyCardMigrationStatus;
  reason: string;
  cardAddress: string;
  tierCount: number;
  metadataTierCount: number;
  membershipFeeCount: number | null;
  metadataMembershipFeeCount: number;
  hasMembershipSchedule: boolean;
  hasQualificationMode: boolean;
};

type AuditMetadata = CardMetadataFromUri & {
  tierQualificationMode?: unknown;
  tierMigration?: { status?: unknown };
};

function positiveAmountLike(value: unknown): boolean {
  try {
    return typeof value === "bigint"
      ? value > 0n
      : typeof value === "number"
      ? Number.isFinite(value) && value > 0
      : typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0;
  } catch {
    return false;
  }
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
  cardAddress: string;
  metadata: CardMetadataFromUri | null | undefined;
  upgradeType: number;
  chainTierCount?: number | null;
  membershipFeeCount?: number | null;
}): LegacyCardMigrationAudit {
  const metadata = (input.metadata ?? {}) as AuditMetadata;
  const metadataTierCount = Array.isArray(metadata.tiers)
    ? metadata.tiers.length
    : 0;
  const chainTierCountKnown = Number.isFinite(input.chainTierCount);
  const membershipFeeCountKnown = Number.isFinite(input.membershipFeeCount);
  const tierCount = chainTierCountKnown
    ? Math.max(0, Number(input.chainTierCount))
    : 0;
  const membershipFeeCount = membershipFeeCountKnown
    ? Math.max(0, Number(input.membershipFeeCount))
    : null;
  const metadataMembershipFeeCount =
    (positiveAmountLike(metadata.baseMembership?.membershipFeeE6) ||
    positiveAmountLike(metadata.baseMembership?.membershipFee)
      ? 1
      : 0) +
    (Array.isArray(metadata.tiers)
      ? metadata.tiers.filter(
          (tier) =>
            positiveAmountLike(tier?.membershipFeeE6) ||
            positiveAmountLike(tier?.membershipFee)
        ).length
      : 0);
  const hasQualificationMode =
    metadata.tierQualificationMode === 0 ||
    metadata.tierQualificationMode === 1 ||
    metadata.tierQualificationMode === 2;
  const hasMembershipSchedule =
    metadataMembershipFeeCount > 0 ||
    (membershipFeeCountKnown && (membershipFeeCount ?? 0) > 0);
  const explicitlyMigrated = metadata.tierMigration?.status === "migrated";

  if (explicitlyMigrated) {
    return {
      status: "migrated",
      reason: "This card already has the canonical tier configuration.",
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      membershipFeeCount,
      metadataMembershipFeeCount,
      hasMembershipSchedule,
      hasQualificationMode,
    };
  }

  if (!input.metadata) {
    return {
      status: "legacy-ambiguous",
      reason:
        "Card metadata is unavailable, so the existing tier layout cannot be compared safely.",
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      membershipFeeCount,
      metadataMembershipFeeCount,
      hasMembershipSchedule,
      hasQualificationMode,
    };
  }

  if (
    metadataTierCount > 0 &&
    (!chainTierCountKnown || tierCount !== metadataTierCount)
  ) {
    return {
      status: "legacy-ambiguous",
      reason: chainTierCountKnown
        ? "The metadata tier count does not match the on-chain tier slots."
        : "The on-chain tier slots could not be read, so the metadata tiers cannot be matched safely.",
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      membershipFeeCount,
      metadataMembershipFeeCount,
      hasMembershipSchedule,
      hasQualificationMode,
    };
  }

  if (
    metadataMembershipFeeCount > 0 &&
    membershipFeeCountKnown &&
    membershipFeeCount !== metadataMembershipFeeCount
  ) {
    return {
      status: "legacy-ambiguous",
      reason:
        "The metadata membership fee schedule does not match the on-chain fee slots.",
      cardAddress: input.cardAddress,
      tierCount,
      metadataTierCount,
      membershipFeeCount,
      metadataMembershipFeeCount,
      hasMembershipSchedule,
      hasQualificationMode,
    };
  }

  return {
    status: "legacy-review",
    reason:
      !chainTierCountKnown || !membershipFeeCountKnown
        ? "The card is legacy; some on-chain layout data is unavailable and must be confirmed before migration."
        : input.upgradeType < 0
        ? "The card is legacy and its on-chain qualification mode still needs confirmation."
        : "The card is legacy and requires explicit owner review before tier migration.",
    cardAddress: input.cardAddress,
    tierCount,
    metadataTierCount,
    membershipFeeCount,
    metadataMembershipFeeCount,
    hasMembershipSchedule,
    hasQualificationMode,
  };
}
