#!/usr/bin/env node
/**
 * Reproducible evidence for §2A invite → stash → bind code path (no device claim).
 * Run: node scripts/probeAgentInvitePath.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const inviteSample = '0xc31000000000000000000000000000000000170E'

const checks = []

function read(rel) {
	return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assert(name, ok, detail) {
	checks.push({ name, ok: Boolean(ok), detail: detail || '' })
}

const pending = read('src/utils/pendingConsumerDeepLink.ts')
assert(
	'android_local_shell_host',
	pending.includes('appassets.androidplatform.net') && pending.includes('isEmbeddedLocalShellPath'),
	'pendingConsumerDeepLink accepts appassets + /index.html',
)
assert(
	'invite_before_path_gate',
	/collectDeepLinkSearchParams[\s\S]*invite[\s\S]*isBeamioAppPath/.test(pending) ||
		pending.indexOf('invite') < pending.indexOf('isBeamioAppPath'),
	'invite= checked before http path gate',
)
assert(
	'apply_pending_flattens',
	pending.includes('collectDeepLinkSearchParams(pending)') && pending.includes("key === 'target'"),
	'applyPending flattens nested target= / invite=',
)

const stash = read('src/utils/agentInviteIntroducerStash.ts')
assert(
	'stash_key',
	stash.includes("beamio:agentInviteIntroducer:v1"),
	'localStorage stash key',
)
assert(
	'parse_invite_param',
	stash.includes("sp.get('invite')") && stash.includes('stashAgentInviteIntroducerFromCurrentUrl'),
	'parse + stash + strip invite from URL',
)

const bind = read('src/utils/agentInviteReferrerBind.ts')
assert(
	'bind_register_referrer',
	bind.includes('registerReferrerUnderIntroducer') && bind.includes('resolveSigningPrivateKeyArmor'),
	'bind signs RegisterReferrer when armor ready',
)
assert(
	'bind_armor_retry',
	bind.includes('450') || bind.includes('setTimeout'),
	'brief retry when privateKeyArmor late',
)

const app = read('src/App.tsx')
assert(
	'app_bind_effect',
	app.includes('bindStashedAgentInviteReferrerIfNeeded') &&
		app.includes('resolveSigningPrivateKeyArmor(profile)'),
	'App effect gates bind on signing armor',
)
assert(
	'app_stashed_event',
	app.includes('AGENT_INVITE_INTRODUCER_STASHED_EVENT'),
	're-bind on stash event',
)

const loading = read('src/pages/Home/LoadingPage.tsx')
assert(
	'loading_bind_after_onboarding',
	loading.includes('bindStashedAgentInviteReferrerIfNeeded'),
	'cold-start onboarding calls bind',
)

const chip = read('src/components/InvitedByIntroducerChip.tsx')
assert(
	'invited_by_chip',
	chip.includes('Invited by') && chip.includes('fetchIntroducerOf') && chip.includes('readAgentInviteIntroducer'),
	'in-app Invited by: chain first, stash fallback',
)
assert(
	'chip_stash_without_referee',
	chip.includes('AGENT_INVITE_INTRODUCER_STASHED_EVENT') &&
		chip.includes('Stash without referee') &&
		chip.includes("source === 'stash'"),
	'no-wallet gate still renders stash pending bind',
)

const board = read('src/pages/BountyBoard/index.tsx')
assert(
	'bounty_board_mounts_chip',
	board.includes('InvitedByIntroducerChip') && board.includes('refereeEoa={eoa'),
	'BountyBoard referrals shows InvitedByIntroducerChip',
)

const createScreen = read('src/pages/Home/CreateUsernamePinScreen.tsx')
assert(
	'create_id_mounts_chip',
	createScreen.includes('InvitedByIntroducerChip') && createScreen.includes('create_your_beamio_id'),
	'Create your Beamio ID shows stash Invited by',
)
assert(
	'splash_mounts_chip',
	loading.includes('InvitedByIntroducerChip') && loading.includes('your_keys_your_control'),
	'CREATE YOUR BEAMIO ID splash footer shows stash Invited by',
)

const client = read('src/utils/agentReferrerRegistryClient.ts')
assert(
	'registry_introducerOf',
	client.includes('introducerOf') && client.includes('RegisterReferrer'),
	'RPC introducerOf + EIP-712 RegisterReferrer',
)

// Synthetic URL acceptance (mirrors isMeaningfulConsumerAppDeepLink invite branch)
const androidInviteUrl = `https://appassets.androidplatform.net/index.html?invite=${inviteSample}`
const inviteRe = /^0x[0-9a-fA-F]{40}$/
const u = new URL(androidInviteUrl)
const invite = (u.searchParams.get('invite') || '').trim()
assert(
	'synthetic_android_invite_url',
	u.host === 'appassets.androidplatform.net' && inviteRe.test(invite),
	androidInviteUrl,
)

const failed = checks.filter((c) => !c.ok)
const report = {
	goal: 'invite= → stash → referrer bind (+ in-app Invited by)',
	inviteSample,
	checks,
	pass: failed.length === 0,
	note: 'Code-path evidence only. Do not claim true-device shell referral PASS; request §2H referral E2E from PM.',
}

const outDir = path.join(root, '.tmp-invite-path-probe')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'PROBE-REPORT.json')
fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nWrote ${outFile}`)
process.exit(failed.length === 0 ? 0 : 1)
