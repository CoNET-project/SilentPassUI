/**
 * RedeemListScreen - 独立全屏窗口，从右滑入，显示 owner 已创建的完整 redeem 一览，支持 Cancel
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { ethers } from 'ethers'
import { Check, X, AlertCircle, Loader } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatAmount } from '@/services/currency'
import {
    signExecuteForOwner,
    encodeCancelRedeem,
    postExecuteForOwner,
    getRedeemStatusBatchFromChain,
} from '@/services/BeamioCard'
import { CoNET_Data } from '@/utils/globals'

type Props = {
    onClose: () => void
}

export default function RedeemListScreen({ onClose }: Props) {
    const { profiles } = useDaemonContext()
    const [itemStatuses, setItemStatuses] = useState<Record<string, 'redeemed' | 'cancelled' | 'pending'>>({})
    const [cancelLoadingHash, setCancelLoadingHash] = useState<string | null>(null)
    const [error, setError] = useState('')

    const cardRedeems = CoNET_Data?.cardRedeems ?? []

    const refreshBatchStatuses = useCallback(async (batchesToRefresh: CardRedeemBatch[]) => {
        const items = batchesToRefresh.flatMap((b) => b.items.map((item) => ({ cardAddress: b.cardAddress, hash: item.hash })))
        if (items.length === 0) return
        const next = await getRedeemStatusBatchFromChain(items)
        setItemStatuses((prev) => ({ ...prev, ...next }))
    }, [])

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
                const hash = ethers.keccak256(ethers.toUtf8Bytes(code))
                setItemStatuses((prev) => ({ ...prev, [hash]: 'cancelled' }))
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
                                        {batch.cardName ?? batch.cardAddress.slice(0, 10) + '…'} · {formatAmount(Number(batch.pointsHuman), batch.currency as any)} pts × {batch.items.length}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(batch.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {batch.items.map((item) => {
                                        const st = itemStatuses[item.hash] ?? 'pending'
                                        return (
                                            <div
                                                key={item.hash}
                                                className="flex items-center justify-between gap-2 py-1.5"
                                            >
                                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate flex-1">
                                                    {item.code}
                                                </span>
                                                {st === 'redeemed' && (
                                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" strokeWidth={2.5} />
                                                )}
                                                {st === 'cancelled' && (
                                                    <span className="text-xs text-slate-400">Cancelled</span>
                                                )}
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
        </div>
    )
}
