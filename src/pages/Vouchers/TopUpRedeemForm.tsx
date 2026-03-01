/**
 * TopUpRedeemForm - Owner 通过 createRedeemBatch 批量发行 redeem codes（空投）
 * 流程：选择卡 → 输入 pts → 输入数量 → generateCODE × N → 签名 → 提交 API cardCreateRedeem → 存入 CoNET_Data.cardRedeems
 * 已创建 redeem 列表：从 CoNET_Data 读取，链上查状态，已兑换显示绿色 check，未兑换显示 Cancel
 */
import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { Gift, Loader, ChevronRight, AlertCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatAmount } from '@/services/currency'
import {
    signExecuteForOwner,
    getCardOwner,
    postCardCreateRedeem,
    encodeCreateRedeemBatch,
    type UserCardInfo,
    type CardRedeemBatch,
    type CardRedeemItem,
} from '@/services/BeamioCard'
import { generateCODE } from '@/services/beamio'
import { fiatPrefix } from '@/services/currency'
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { storeSystemData, flushStoreSystemData } from '@/services/beamio'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'

type Props = {
    userCards: UserCardInfo[]
    onClose: () => void
    /** 创建成功后调用，可传入更新后的 redeem 列表以便父组件立即刷新 UI */
    onSuccess?: (newBatches?: CardRedeemBatch[]) => void
}

const NAV_TOP = 'env(safe-area-inset-top)'

function cx(...v: Array<string | false | undefined | null>) {
    return v.filter(Boolean).join(' ')
}

export default function TopUpRedeemForm({ userCards, onClose, onSuccess }: Props) {
    const { profiles } = useDaemonContext()
    const [selectedCard, setSelectedCard] = useState<UserCardInfo | null>(userCards[0] ?? null)
    const [pointsInput, setPointsInput] = useState('')
    const [quantityInput, setQuantityInput] = useState('5')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [createdBatch, setCreatedBatch] = useState<CardRedeemBatch | null>(null)

    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(''), 4000)
            return () => clearTimeout(t)
        }
    }, [error])

    const points6 = (() => {
        const n = parseFloat(pointsInput)
        if (!Number.isFinite(n) || n <= 0) return null
        return BigInt(Math.round(n * 1_000_000))
    })()

    const quantity = (() => {
        const n = parseInt(quantityInput, 10)
        if (!Number.isFinite(n) || n < 1 || n > 100) return null
        return n
    })()

    const handleSubmit = async () => {
        if (!selectedCard || !points6 || !quantity) {
            setError('Please select a card, enter points and quantity')
            return
        }

        const profile = profiles?.[0]
        if (!profile?.privateKeyArmor) {
            setError('Please log in first')
            return
        }

        setLoading(true)
        setError('')
        try {
            const wallet = new ethers.Wallet(profile.privateKeyArmor)
            const cardOwner = await getCardOwner(selectedCard.cardAddress)
            if (ethers.getAddress(cardOwner) !== ethers.getAddress(wallet.address)) {
                setError('This card is owned by your AA account. Create redeem requires the card owner to sign. Please use a card owned by your EOA, or create new cards with your EOA as owner.')
                setLoading(false)
                return
            }

            const codes: string[] = []
            for (let i = 0; i < quantity; i++) {
                const { code } = generateCODE('')
                codes.push(code)
            }

            const now = Math.floor(Date.now() / 1000)
            const validAfter = now - 60
            const validBefore = now + 86400 * 30
            const deadline = now + 3600
            const nonce = ethers.hexlify(ethers.randomBytes(32))

            const data = encodeCreateRedeemBatch(codes, points6, validAfter, validBefore)
            const ownerSignature = await signExecuteForOwner(
                profile.privateKeyArmor,
                selectedCard.cardAddress,
                data,
                deadline,
                nonce
            )

            const result = await postCardCreateRedeem({
                cardAddress: selectedCard.cardAddress,
                codes,
                points6: points6.toString(),
                validAfter,
                validBefore,
                deadline,
                nonce,
                ownerSignature,
            })

            if (result.success && result.codes) {
                const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                const items: CardRedeemItem[] = result.codes.map((code) => ({
                    code,
                    hash: ethers.keccak256(ethers.toUtf8Bytes(code)),
                }))
                const batch: CardRedeemBatch = {
                    batchId,
                    cardAddress: selectedCard.cardAddress,
                    cardName: selectedCard.name,
                    currency: selectedCard.currency,
                    points6: points6.toString(),
                    pointsHuman: pointsInput,
                    ptsPer1Currency: selectedCard.ptsPer1Currency,
                    createdAt: Date.now(),
                    items,
                }
                const prev = CoNET_Data
                const updatedList: CardRedeemBatch[] = prev
                    ? [...((prev as any).cardRedeems ?? []), batch]
                    : [batch]
                if (prev) {
                    const next = { ...prev, cardRedeems: updatedList } as any
                    setCoNET_Data(next)
                    await storeSystemData()
                    await flushStoreSystemData()
                }
                setCreatedBatch(batch)
                setSuccess(true)
                onSuccess?.(updatedList)
            } else {
                setError(result.error ?? 'Submission failed')
            }
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setLoading(false)
        }
    }

    if (success && createdBatch) {
        return (
            <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
                <BeamioNavBack title="" onClose={onClose} onMore={() => {}} />
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-6">
                        <Gift className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Redeems created</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                        {createdBatch.items.length} redeem codes created (<span className="text-2xl font-semibold">{fiatPrefix(createdBatch.currency as any)}{formatAmount((createdBatch.ptsPer1Currency ? Number(createdBatch.pointsHuman) / Number(createdBatch.ptsPer1Currency) : Number(createdBatch.pointsHuman)), createdBatch.currency as any)}</span> each)
                    </p>
                    <div className="w-full max-w-[320px] space-y-2 mb-6 max-h-40 overflow-y-auto">
                        {createdBatch.items.slice(0, 5).map((item, i) => (
                            <p key={item.hash} className="text-xs font-mono text-slate-500 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded truncate">
                                {item.code}
                            </p>
                        ))}
                        {createdBatch.items.length > 5 && (
                            <p className="text-xs text-slate-400">+{createdBatch.items.length - 5} more...</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full max-w-[320px] h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] active:scale-[0.99]"
                    >
                        Done
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Select card */}
                <div className="mb-4">
                    <div className="space-y-2">
                        {userCards.map((c) => {
                            const active = selectedCard?.cardAddress === c.cardAddress
                            return (
                                <button
                                    key={c.cardAddress}
                                    type="button"
                                    onClick={() => setSelectedCard(c)}
                                    className={cx(
                                        'w-full flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition-all',
                                        active
                                            ? 'border-[#1D5BFF] bg-blue-50/30 dark:bg-blue-900/20'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50'
                                    )}
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                                        <p className="text-xs text-slate-500 font-mono truncate">{c.cardAddress.slice(0, 10)}...{c.cardAddress.slice(-8)}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            1 {fiatPrefix(c.currency as any)} = {formatAmount(Number(c.ptsPer1Currency), c.currency as any)} pts
                                        </p>
                                    </div>
                                    <ChevronRight className={cx('w-5 h-5 shrink-0', active ? 'text-[#1D5BFF]' : 'text-slate-400')} strokeWidth={2.2} />
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Points */}
                <div className="mb-4">
                    
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Points, e.g. 100"
                        value={pointsInput}
                        onChange={(e) => setPointsInput(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                </div>

                {/* Quantity */}
                <div className="mb-6">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        Quantity
                    </label>
                    <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        max={100}
                        placeholder="e.g. 5"
                        value={quantityInput}
                        onChange={(e) => setQuantityInput(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !points6 || !quantity}
                    className={cx(
                        'w-full h-12 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all',
                        loading || !points6 || !quantity
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-[#1D5BFF] text-white active:scale-[0.99]'
                    )}
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" strokeWidth={2.2} />
                            Creating...
                        </>
                    ) : (
                        'Create'
                    )}
                </button>
            </div>
        </div>
    )
}
