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
 * Existing cards may be silently migrated when their non-empty metadata tier
 * schedule is the canonical source for a legacy card. The migration caller
 * still owns the safety gates: explicit migration markers remain migrated,
 * unavailable metadata remains ambiguous, and empty metadata never authorizes
 * replacing the on-chain schedule.
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

  return {
    status: "legacy-review",
    reason:
      metadataTierCount === 0
        ? "The card has no metadata tier schedule and cannot be silently migrated."
        : !chainTierCountKnown
          ? "The card is legacy; metadata tiers are available, but the on-chain tier read is unavailable."
          : input.upgradeType < 0
            ? "The card is legacy and its on-chain qualification mode still needs confirmation."
            : "The legacy card will use its non-empty metadata tiers as the migration source of truth.",
    cardAddress: input.cardAddress,
    tierCount,
    metadataTierCount,
    membershipFeeCount,
    metadataMembershipFeeCount,
    hasMembershipSchedule,
    hasQualificationMode,
  };
}
