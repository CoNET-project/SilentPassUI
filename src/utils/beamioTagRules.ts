/**
 * beamioTag / Business Handle — same allowed set as x402sdk `BEAMIO_ACCOUNT_NAME_RE` (Cluster `/addUser`).
 * Only 3–26 chars from [a-zA-Z0-9_.]; no hyphen.
 */
export const BEAMIO_TAG_MIN_LEN = 3
export const BEAMIO_TAG_MAX_LEN = 26
export const BEAMIO_TAG_ALLOWED_RE = /^[a-zA-Z0-9_.]{3,26}$/

export function isValidBeamioTag(raw: string): boolean {
	return BEAMIO_TAG_ALLOWED_RE.test(normalizeBeamioTagInput(raw))
}

/** IME / paste: fullwidth → ASCII, strip zero-width, trim, strip @. Matches SilentPassUI `normalizeBeamioTagInput`. */
export function normalizeBeamioTagInput(raw: string): string {
	return String(raw)
		.replace(/@/g, "")
		.trim()
		.normalize("NFKC")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
}

export const BEAMIO_TAG_RULE_HINT = "Use 3–26 letters, numbers, dots, or underscores"
