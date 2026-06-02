import { IpfsImg } from '@/components/IpfsImg';
/**
 * RedeemListScreen - 独立全屏窗口，从右滑入，显示 owner 已创建的完整 redeem 一览，支持 Cancel
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ethers } from 'ethers'
import { Check, X, AlertCircle, Loader, Copy } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/logo512.png'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatAmount, fiatPrefix } from '@/services/currency'
import {
    signExecuteForOwner,
    encodeCancelRedeem,
    postExecuteForOwner,
    getRedeemStatusBatchFromChain,
    removeNotFoundRedeems,
    getCardOwner,
} from '@/services/BeamioCard'
import { CoNET_Data } from '@/utils/globals'
import type { RedeemStatusChain, CardRedeemBatch } from '@/services/BeamioCard'

type Props = {
    onClose: () => void
    onRemoveNotFound?: () => void
    /** 父组件创建新 redeem 后递增，触发本组件重新从 CoNET_Data 读取 */
    refreshVersion?: number
    /** 父组件传入的 batches，优先使用；与 Redeem Active List 同源，确保新建 redeem 在 detail 中显示 */
    batches?: CardRedeemBatch[]
}

export default function RedeemListScreen({ onClose, onRemoveNotFound, refreshVersion, batches: batchesProp }: Props) {
    const { profiles, beamio } = useDaemonContext()
    const [itemStatuses, setItemStatuses] = useState<Record<string, RedeemStatusChain>>({})
    const [cancelLoadingHash, setCancelLoadingHash] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [redeemsVersion, setRedeemsVersion] = useState(0)
    const [qrCopied, setQrCopied] = useState(false)
    const [qrRedeem, setQrRedeem] = useState<{
        cardAddress: string
        redeemCode: string
        cardName?: string
        currency?: string
        pointsHuman: string
        ptsPer1Currency?: string
    } | null>(null)

    const redeemQrUrl = useMemo(() => {
        if (!qrRedeem) return ''
        return `https://beamio.app/app/?beamiocard=${encodeURIComponent(qrRedeem.cardAddress)}&redeemcode=${encodeURIComponent(qrRedeem.redeemCode)}`
    }, [qrRedeem])

    const beamioAvatarSrc = beamio?.image?.trim()
        ? beamio.image
        : `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(beamio?.accountName || 'Beamio')}`
    const handleCopyRedeemUrl = useCallback(async () => {
        if (!redeemQrUrl) return
        try {
            await navigator.clipboard.writeText(redeemQrUrl)
            setQrCopied(true)
        } catch {}
    }, [redeemQrUrl])

    useEffect(() => {
        if (!qrCopied) return
        const t = setTimeout(() => setQrCopied(false), 3000)
        return () => clearTimeout(t)
    }, [qrCopied])

    const displayNameTag = useMemo(() => {
        if (!beamio) return ''
        const lastnameLines = beamio.lastName?.split('\r\n') || []
        const lastNamePart = /^\{/.test(lastnameLines[0] ?? '') ? '' : (lastnameLines[0] ?? '')
        const fullName = `${beamio.firstName || ''} ${lastNamePart}`.trim()
        const tag = beamio.accountName ? ` @${beamio.accountName}` : ''
        return fullName ? `${fullName}${tag}` : (beamio.accountName ? `@${beamio.accountName}` : '')
    }, [beamio])

    const cardRedeems = useMemo(
        () => (batchesProp !== undefined ? batchesProp : (CoNET_Data?.cardRedeems ?? [])),
        [batchesProp, redeemsVersion, refreshVersion ?? 0]
    )

    const refreshBatchStatuses = useCallback(async (batchesToRefresh: CardRedeemBatch[]) => {
        const items = batchesToRefresh.flatMap((b) => b.items.map((item) => ({ cardAddress: b.cardAddress, hash: item.hash, code: item.code })))
        if (items.length === 0) return
        const next = await getRedeemStatusBatchFromChain(items)
        const notFoundHashes = Object.entries(next).filter(([, v]) => v === 'not_found').map(([h]) => h)
        if (notFoundHashes.length > 0) {
            removeNotFoundRedeems(new Set(notFoundHashes))
            setRedeemsVersion((v) => v + 1)
            onRemoveNotFound?.()
        }
        setItemStatuses((prev) => ({ ...prev, ...next }))
    }, [onRemoveNotFound])

    const batchIds = useMemo(() => cardRedeems.map((b) => b.batchId).join(','), [cardRedeems])
    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(''), 4000)
            return () => clearTimeout(t)
        }
    }, [error])

    useEffect(() => {
        if (cardRedeems.length > 0) refreshBatchStatuses(cardRedeems)
    }, [batchIds, refreshBatchStatuses])

    const handleCancelRedeem = async (code: string, cardAddress: string, hash: string) => {
        const profile = profiles?.[0]
        if (!profile?.privateKeyArmor) {
            setError('Please log in first')
            return
        }
        setCancelLoadingHash(hash)
        setError('')
        try {
            const wallet = new ethers.Wallet(profile.privateKeyArmor)
            const cardOwner = await getCardOwner(cardAddress)
            if (ethers.getAddress(cardOwner) !== ethers.getAddress(wallet.address)) {
                setError('This card is owned by your AA account. Cancel redeem requires the card owner to sign. Please use a card owned by your EOA.')
                setCancelLoadingHash(null)
                return
            }

            const data = encodeCancelRedeem(code)
            const now = Math.floor(Date.now() / 1000)
            const deadline = now + 3600
            const nonce = ethers.hexlify(ethers.randomBytes(32))
            const ownerSignature = await signExecuteForOwner(
                profile.privateKeyArmor,
                cardAddress,
                data,
                deadline,
                nonce
            )
            const result = await postExecuteForOwner({
                cardAddress,
                data,
                deadline,
                nonce,
                ownerSignature,
            })
            if (result.success) {
                removeNotFoundRedeems(new Set([hash]))
                setRedeemsVersion((v) => v + 1)
                setItemStatuses((prev) => {
                    const next = { ...prev }
                    delete next[hash]
                    return next
                })
                onRemoveNotFound?.()
            } else {
                setError(result.error ?? 'Cancel failed')
            }
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setCancelLoadingHash(null)
        }
    }

    return (
        <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {cardRedeems.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                        No created redeems yet. Use Airdrop / Top Up to create redeem codes.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {[...cardRedeems].reverse().map((batch) => (
                            <div
                                key={batch.batchId}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4"
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {batch.cardName ?? batch.cardAddress.slice(0, 10) + '…'} · <span className="text-xl">{fiatPrefix(batch.currency as any)}{formatAmount((batch.ptsPer1Currency ? Number(batch.pointsHuman) / Number(batch.ptsPer1Currency) : Number(batch.pointsHuman)), batch.currency as any)}</span> × {batch.items.length}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(batch.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {/* active=false -> not_found and removed; only pending shown */}

                                <div className="space-y-1.5">
                                    {batch.items.map((item) => {
                                        const st = itemStatuses[item.hash] ?? 'pending'
                                        if (st === 'not_found') return null
                                        return (
                                            <div
                                                key={item.hash}
                                                className="flex items-center justify-between gap-2 py-1.5"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setQrRedeem({
                                                        cardAddress: batch.cardAddress,
                                                        redeemCode: item.code,
                                                    cardName: batch.cardName,
                                                    currency: batch.currency,
                                                    pointsHuman: batch.pointsHuman,
                                                    ptsPer1Currency: batch.ptsPer1Currency,
                                                    })}
                                                    className="text-left text-xs font-mono text-slate-600 dark:text-slate-400 truncate flex-1 hover:text-slate-800 dark:hover:text-slate-200 active:opacity-70"
                                                >
                                                    {item.code}
                                                </button>
                                                {st === 'pending' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCancelRedeem(item.code, batch.cardAddress, item.hash)}
                                                        disabled={cancelLoadingHash !== null}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 min-w-[72px] justify-center"
                                                    >
                                                        {cancelLoadingHash === item.hash ? (
                                                            <Loader className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                                                        ) : (
                                                            <>
                                                                <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                                                                Cancel
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm mt-4">
                        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                        {error}
                    </div>
                )}
            </div>

            {/* Redeem QR 滑出窗 */}
            <AnimatePresence>
                {qrRedeem && (
                    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50"
                            onClick={() => { setQrRedeem(null); setQrCopied(false) }}
                            aria-hidden
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            className="relative bg-white dark:bg-slate-900 rounded-t-[22px] overflow-hidden pb-[env(safe-area-inset-bottom)]"
                        >
                            <div
                                className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15 mx-auto mt-2 mb-1"
                                aria-hidden
                            />
                            <div className="px-6 pt-2 pb-6 flex flex-col items-center">
                                {/* Beamio 标志性 avatar */}
                                <IpfsImg
                                    src={beamioAvatarSrc}
                                    alt=""
                                    className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-600 shrink-0"
                                />
                                {/* firstname + lastname + @ beamioTag */}
                                {displayNameTag && (
                                    <p className="mt-2 text-[15px] font-medium text-slate-700 dark:text-slate-200">
                                        {displayNameTag}
                                    </p>
                                )}
                                {/* redeem 具体资产 */}
                                {qrRedeem && (
                                    <p className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
                                        {qrRedeem.cardName ?? qrRedeem.cardAddress.slice(0, 10) + '…'}
                                        <span className="text-[var(--beamio-brand,#2F78FF)] text-2xl">
                                            {' '}· {fiatPrefix(qrRedeem.currency as any)}{formatAmount((qrRedeem.ptsPer1Currency ? Number(qrRedeem.pointsHuman) / Number(qrRedeem.ptsPer1Currency) : Number(qrRedeem.pointsHuman)), qrRedeem.currency as any)}
                                        </span>
                                    </p>
                                )}
                                {/* QR */}
                                <div className="mt-4 rounded-[28px] bg-white p-[18px] shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]">
                                    <QRCodeCanvas
                                        value={redeemQrUrl}
                                        size={264}
                                        level="H"
                                        includeMargin={false}
                                        bgColor="white"
                                        fgColor="#000000"
                                        imageSettings={{
                                            src: bIcon,
                                            height: 95,
                                            width: 95,
                                            excavate: true,
                                        }}
                                        className="block"
                                    />
                                </div>
                                {/* URL + Copy 按钮 */}
                                <div className="mt-4 w-full max-w-[320px]">
                                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-600 px-4 py-3 flex items-center justify-between gap-3">
                                        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 break-all flex-1 min-w-0">
                                            {redeemQrUrl}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleCopyRedeemUrl}
                                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600 hover:ring-[var(--beamio-brand,#2F78FF)] active:scale-95"
                                            aria-label={qrCopied ? 'Copied' : 'Copy'}
                                        >
                                            <AnimatePresence mode="wait">
                                                {qrCopied ? (
                                                    <motion.span
                                                        key="check"
                                                        initial={{ scale: 0.5, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        exit={{ scale: 0.5, opacity: 0 }}
                                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                                    >
                                                        <Check className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
                                                    </motion.span>
                                                ) : (
                                                    <motion.span
                                                        key="copy"
                                                        initial={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                    >
                                                        <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400" strokeWidth={2} />
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
