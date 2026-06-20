import React, { useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import { CONET_CARD_FACTORY } from '@/config/chainAddresses'
import { tu } from '@/locale/beamioLocale'
import {
	LONGDHANG_OLD_BASE_CARD,
	isLongDhangMigrationOwnerEoa,
	type LongDhangMigrationRunResult,
	type LongDhangMigrationSnapshot,
	createLongDhangMigrationCard,
	encodeAddAdminWithMintLimit,
	postCardAddAdmin,
	previewLongDhangMigration,
	runLongDhangMigration,
	signExecuteForOwner,
	signLongDhangMigrationAuthorization,
	verifyLongDhangMigration,
} from '@/services/BeamioCard'

type LongDhangConetMigrationPanelProps = {
	currentEoa?: string | null
	privateKeyArmor?: string | null
	className?: string
}

function formatPoints6(raw: string | undefined): string {
	try {
		return Number(ethers.formatUnits(BigInt(raw ?? '0'), 6)).toLocaleString(undefined, {
			maximumFractionDigits: 2,
		})
	} catch {
		return '0'
	}
}

function shortAddr(address: string | undefined): string {
	if (!address || !ethers.isAddress(address)) return '—'
	const a = ethers.getAddress(address)
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function AddressPill({ address, tone = 'blue' }: { address: string; tone?: 'blue' | 'purple' | 'slate' }) {
	const [copied, setCopied] = useState(false)
	const toneClass =
		tone === 'purple'
			? 'border-[#eadcf7] bg-[#f5ecff] text-[#424655]'
			: tone === 'slate'
				? 'border-slate-200 bg-slate-50 text-slate-700'
				: 'border-[#dce2f7] bg-[#e9edff] text-[#424655]'
	return (
		<button
			type="button"
			onClick={async () => {
				await navigator.clipboard.writeText(address)
				setCopied(true)
				window.setTimeout(() => setCopied(false), 2000)
			}}
			className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold ${toneClass}`}
			title={address}
		>
			<span>{shortAddr(address)}</span>
			{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
		</button>
	)
}

export function LongDhangConetMigrationPanel({
	currentEoa,
	privateKeyArmor,
	className = '',
}: LongDhangConetMigrationPanelProps) {
	const isOwner = useMemo(() => isLongDhangMigrationOwnerEoa(currentEoa), [currentEoa])
	const [snapshot, setSnapshot] = useState<LongDhangMigrationSnapshot | null>(null)
	const [newCardAddress, setNewCardAddress] = useState('')
	const [migrationAdmin, setMigrationAdmin] = useState('')
	const [busy, setBusy] = useState<'preview' | 'create' | 'authorize' | 'run' | 'verify' | null>(null)
	const [notice, setNotice] = useState<{ kind: 'success' | 'warn' | 'error'; text: string } | null>(null)
	const [runResult, setRunResult] = useState<LongDhangMigrationRunResult | null>(null)
	const [verifySummary, setVerifySummary] = useState<string | null>(null)

	if (!isOwner) return null

	const requireSnapshot = (): LongDhangMigrationSnapshot => {
		if (!snapshot) throw new Error('Preview the snapshot first.')
		return snapshot
	}

	const requireOwnerKey = (): string => {
		const pk = privateKeyArmor?.trim()
		if (!pk) throw new Error('Owner private key is not available. Unlock this workspace first.')
		return pk
	}

	const handlePreview = async (force = false) => {
		setBusy('preview')
		setNotice(null)
		try {
			const res = await previewLongDhangMigration(force)
			if (!res.success || !res.snapshot) throw new Error(res.error ?? 'Snapshot preview failed.')
			setSnapshot(res.snapshot)
			setMigrationAdmin(res.snapshot.migrationAdmin)
			setNotice({ kind: 'success', text: 'Snapshot preview loaded.' })
		} catch (e: any) {
			setNotice({ kind: 'error', text: e?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleCreateCard = async () => {
		setBusy('create')
		setNotice(null)
		try {
			const snap = requireSnapshot()
			const pk = requireOwnerKey()
			const ownerEoa = ethers.getAddress(currentEoa!)
			const ownerSignature = await signLongDhangMigrationAuthorization({
				privateKeyArmor: pk,
				action: 'create-card',
				ownerEoa,
				snapshotHash: snap.snapshotHash,
			})
			const res = await createLongDhangMigrationCard({
				ownerEoa,
				snapshotHash: snap.snapshotHash,
				ownerSignature,
			})
			if (!res.success || !res.cardAddress) throw new Error(res.error ?? 'Create CoNET card failed.')
			setNewCardAddress(ethers.getAddress(res.cardAddress))
			if (res.migrationAdmin) setMigrationAdmin(ethers.getAddress(res.migrationAdmin))
			setNotice({ kind: 'success', text: 'New CoNET card created. Authorize the migration admin next.' })
		} catch (e: any) {
			setNotice({ kind: 'error', text: e?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleAuthorizeAdmin = async () => {
		setBusy('authorize')
		setNotice(null)
		try {
			const snap = requireSnapshot()
			const pk = requireOwnerKey()
			if (!newCardAddress || !ethers.isAddress(newCardAddress)) throw new Error('Create or paste the new CoNET card first.')
			if (!migrationAdmin || !ethers.isAddress(migrationAdmin)) throw new Error('Migration admin is unavailable.')
			const mintLimit = BigInt(snap.totalBalanceE6)
			const metadata = JSON.stringify({
				source: 'longdhangConetMigration',
				snapshotHash: snap.snapshotHash,
				oldBaseCard: ethers.getAddress(LONGDHANG_OLD_BASE_CARD),
			})
			const data = encodeAddAdminWithMintLimit(ethers.getAddress(migrationAdmin), 1, metadata, mintLimit)
			const deadline = Math.floor(Date.now() / 1000) + 15 * 60
			const nonce = ethers.hexlify(ethers.randomBytes(32))
			const ownerSignature = await signExecuteForOwner(pk, ethers.getAddress(newCardAddress), data, deadline, nonce, CONET_CARD_FACTORY)
			const res = await postCardAddAdmin({
				cardAddress: ethers.getAddress(newCardAddress),
				data,
				deadline,
				nonce,
				ownerSignature,
			})
			if (!res.success) throw new Error(res.error ?? 'Authorize migration admin failed.')
			setNotice({ kind: 'success', text: 'Migration admin authorized on the new CoNET card.' })
		} catch (e: any) {
			setNotice({ kind: 'error', text: e?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleRun = async () => {
		setBusy('run')
		setNotice(null)
		try {
			const snap = requireSnapshot()
			const pk = requireOwnerKey()
			if (!newCardAddress || !ethers.isAddress(newCardAddress)) throw new Error('New CoNET card is required.')
			const ownerEoa = ethers.getAddress(currentEoa!)
			const ownerSignature = await signLongDhangMigrationAuthorization({
				privateKeyArmor: pk,
				action: 'run-migration',
				ownerEoa,
				snapshotHash: snap.snapshotHash,
				newCardAddress: ethers.getAddress(newCardAddress),
			})
			const res = await runLongDhangMigration({
				newCardAddress: ethers.getAddress(newCardAddress),
				ownerEoa,
				snapshotHash: snap.snapshotHash,
				ownerSignature,
				limit: 25,
			})
			setRunResult(res)
			if (!res.success) throw new Error(res.error ?? 'Migration batch failed.')
			setNotice({ kind: 'success', text: `Batch complete: ${res.minted} minted, ${res.skipped} skipped.` })
		} catch (e: any) {
			setNotice({ kind: 'error', text: e?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const handleVerify = async () => {
		setBusy('verify')
		setNotice(null)
		try {
			if (!newCardAddress || !ethers.isAddress(newCardAddress)) throw new Error('New CoNET card is required.')
			const res = await verifyLongDhangMigration(ethers.getAddress(newCardAddress))
			if (!res.success) throw new Error(res.error ?? `Verification found ${res.mismatches?.length ?? 0} mismatch(es).`)
			setVerifySummary(
				`${res.matches ?? 0}/${res.totalRows ?? 0} balances match. ` +
				`${res.terminals?.matches ?? 0}/${res.terminals?.total ?? 0} payment terminals match.`
			)
			setNotice({ kind: 'success', text: 'Migration verification passed.' })
		} catch (e: any) {
			setNotice({ kind: 'error', text: e?.message ?? String(e) })
		} finally {
			setBusy(null)
		}
	}

	const buttonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60'
	const primary = `${buttonClass} bg-[#1562f0] text-white hover:bg-[#0f4ec4]`
	const secondary = `${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`

	return (
		<section className={`rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:p-5 ${className}`}>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
							<Sparkles className="h-3.5 w-3.5" />
							LongDhang Migration
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
							<ShieldCheck className="h-3.5 w-3.5" />
							Owner only
						</span>
					</div>
					<h3 className="mt-2 font-manrope text-xl font-extrabold tracking-tight text-slate-950">
						Re-issue LongDhang on CoNET
					</h3>
					<p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-600">
						Create a new CoNET program card, authorize the migration admin, then mint each old Base AA token #0 balance to that EOA&apos;s CoNET AA.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" onClick={() => void handlePreview(false)} disabled={busy !== null} className={secondary}>
						{busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						Preview snapshot
					</button>
					<button type="button" onClick={() => void handlePreview(true)} disabled={busy !== null} className={secondary}>{tu('refresh')}</button>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
				<div className="rounded-xl border border-white bg-white/80 p-3">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Old Base Card</p>
					<div className="mt-2"><AddressPill address={LONGDHANG_OLD_BASE_CARD} tone="slate" /></div>
				</div>
				<div className="rounded-xl border border-white bg-white/80 p-3">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Snapshot</p>
					<p className="mt-2 text-lg font-extrabold text-slate-900">
						{snapshot ? `${snapshot.holderCount} AA holders` : 'Not loaded'}
					</p>
					<p className="text-xs font-semibold text-slate-500">
						{snapshot ? `${formatPoints6(snapshot.totalBalanceE6)} points` : 'Run preview first'}
					</p>
				</div>
				<div className="rounded-xl border border-white bg-white/80 p-3">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Migration Admin</p>
					<div className="mt-2">
						{migrationAdmin && ethers.isAddress(migrationAdmin) ? <AddressPill address={migrationAdmin} tone="purple" /> : <span className="text-sm font-semibold text-slate-500">Unavailable</span>}
					</div>
				</div>
			</div>

			{snapshot ? (
				<div className="mt-3 rounded-xl border border-white bg-white/70 p-3">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Snapshot Hash</p>
					<p className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-700">{snapshot.snapshotHash}</p>
					{snapshot.excludedCount > 0 || snapshot.anomalies.length > 0 ? (
						<p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
							<AlertTriangle className="h-3.5 w-3.5" />
							{snapshot.excludedCount} excluded, {snapshot.anomalies.length} anomaly note(s)
						</p>
					) : null}
				</div>
			) : null}

			<div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<button type="button" onClick={() => void handleCreateCard()} disabled={busy !== null || !snapshot} className={primary}>
					{busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Create CoNET Card
				</button>
				<button type="button" onClick={() => void handleAuthorizeAdmin()} disabled={busy !== null || !snapshot || !newCardAddress} className={secondary}>
					{busy === 'authorize' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Authorize Admin
				</button>
				<button type="button" onClick={() => void handleRun()} disabled={busy !== null || !snapshot || !newCardAddress} className={primary}>
					{busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Run Batch
				</button>
				<button type="button" onClick={() => void handleVerify()} disabled={busy !== null || !newCardAddress} className={secondary}>
					{busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Verify
				</button>
			</div>

			<div className="mt-3">
				<label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
					New CoNET Card
				</label>
				<input
					value={newCardAddress}
					onChange={(e) => setNewCardAddress(e.target.value)}
					placeholder="Created card address or paste an existing migration card"
					className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/20"
				/>
			</div>

			{notice ? (
				<p
					className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
						notice.kind === 'success'
							? 'border-emerald-200 bg-emerald-50 text-emerald-700'
							: notice.kind === 'warn'
								? 'border-amber-200 bg-amber-50 text-amber-800'
								: 'border-rose-200 bg-rose-50 text-rose-700'
					}`}
				>
					{notice.text}
				</p>
			) : null}

			{runResult ? (
				<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
					<p className="text-sm font-extrabold text-slate-900">
						Last batch: {runResult.minted} minted, {runResult.skipped} skipped, {runResult.failed} failed
					</p>
					<p className="mt-1 text-xs font-semibold text-slate-500">
						Processed {runResult.processed}/{runResult.totalSnapshotRows}. Re-run batch until all rows are skipped or verified.
					</p>
					{runResult.terminals ? (
						<p className="mt-1 text-xs font-semibold text-slate-500">
							Payment terminals: {runResult.terminals.registered} registered, {runResult.terminals.skipped} skipped, {runResult.terminals.failed} failed.
						</p>
					) : null}
				</div>
			) : null}
			{verifySummary ? <p className="mt-2 text-xs font-bold text-emerald-700">{verifySummary}</p> : null}
		</section>
	)
}
