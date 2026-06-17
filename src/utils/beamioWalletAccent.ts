/** Beamio wallet identity colors — see `.cursor/rules/beamio-eoa-aa-wallet-color-protocol.mdc`. */

export type BeamioWalletKind = 'eoa' | 'aa'

export type BeamioWalletAccentTokens = {
	accent: string
	surfaceBg: string
	border: string
	bodyText: string
	iconShadow: string
	badgeBorderClass: string
	badgeBgClass: string
	badgeTextClass: string
	actionIconClass: string
	iconBgClass: string
	iconShadowClass: string
}

export const BEAMIO_EOA_WALLET_ACCENT: BeamioWalletAccentTokens = {
	accent: '#0051d1',
	surfaceBg: '#e9edff',
	border: '#dce2f7',
	bodyText: '#424655',
	iconShadow: 'rgba(0, 81, 209, 0.22)',
	badgeBorderClass: 'border-[#0051d1]/25',
	badgeBgClass: 'bg-[#0051d1]/5',
	badgeTextClass: 'text-[#0051d1]',
	actionIconClass: 'text-[#0051d1]',
	iconBgClass: 'bg-[#0051d1]',
	iconShadowClass: 'shadow-[0_8px_20px_rgba(0,81,209,0.22)]',
}

export const BEAMIO_AA_WALLET_ACCENT: BeamioWalletAccentTokens = {
	accent: '#8d3a8b',
	surfaceBg: '#f5ecff',
	border: '#eadcf7',
	bodyText: '#424655',
	iconShadow: 'rgba(141, 58, 139, 0.22)',
	badgeBorderClass: 'border-[#8d3a8b]/25',
	badgeBgClass: 'bg-[#8d3a8b]/10',
	badgeTextClass: 'text-[#8d3a8b]',
	actionIconClass: 'text-[#8d3a8b]',
	iconBgClass: 'bg-[#8d3a8b]',
	iconShadowClass: 'shadow-[0_8px_20px_rgba(141,58,139,0.22)]',
}

export function beamioWalletAccent(kind: BeamioWalletKind): BeamioWalletAccentTokens {
	return kind === 'aa' ? BEAMIO_AA_WALLET_ACCENT : BEAMIO_EOA_WALLET_ACCENT
}
