/** Decide Members & Loyalty "Top-up volume (points)" display value.
 * Rule: KPI source is chain-only. API values must never be used as fallback or mixed in.
 */
export function resolveTopupVolumePointsDisplay(
  chainVolumeDisplay: number | null,
  previousDisplay: number | null
): number | null {
  if (chainVolumeDisplay != null && Number.isFinite(chainVolumeDisplay)) return chainVolumeDisplay
  if (previousDisplay != null && Number.isFinite(previousDisplay)) return previousDisplay
  return null
}

