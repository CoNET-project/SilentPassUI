/**
 * beamioTag / Business Handle — same allowed set as x402sdk `BEAMIO_ACCOUNT_NAME_RE` (Cluster `/addUser`).
 * Only 3–20 chars from [a-zA-Z0-9_.]; no hyphen.
 */
export const BEAMIO_TAG_ALLOWED_RE = /^[a-zA-Z0-9_.]{3,20}$/

/** IME / paste: fullwidth → ASCII, strip zero-width, trim, strip @. Matches SilentPassUI `normalizeBeamioTagInput`. */
export function normalizeBeamioTagInput(raw: string): string {
	return String(raw)
		.replace(/@/g, "")
		.trim()
		.normalize("NFKC")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
}

export const BEAMIO_TAG_RULE_HINT = "Use 3–20 letters, numbers, dots, or underscores"
