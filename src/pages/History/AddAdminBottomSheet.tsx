/**
 * AddAdminBottomSheet - Card owner 添加 admin（EOA 地址）
 * 流程：选择卡 → 输入新 admin 地址（须为 EOA，AA 不允许）→ 选择 threshold → 签名 → 提交 API cardAddAdmin → 显示 tx hash
 */
import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { UserPlus, Loader, ChevronRight, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import {
    signExecuteForOwner,
    postCardAddAdmin,
    encodeAddAdmin,
    getCardOwner,
    type UserCardInfo,
} from '@/services/BeamioCard'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { tu } from '@/locale/beamioLocale'

const BASE_EXPLORER = 'https://basescan.org/tx/'

type Props = {
    userCards: UserCardInfo[]
    onClose: () => void
    onSuccess?: () => void
}

function cx(...v: Array<string | false | undefined | null>) {
    return v.filter(Boolean).join(' ')
}

export default function AddAdminBottomSheet({ userCards, onClose, onSuccess }: Props) {
    const { profiles } = useDaemonContext()
    const [selectedCard, setSelectedCard] = useState<UserCardInfo | null>(userCards[0] ?? null)
    const [addressInput, setAddressInput] = useState('')
    const [metadataInput, setMetadataInput] = useState('')
    const [thresholdInput, setThresholdInput] = useState('1')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)

    useEffect(() => {
        if (error) {
            const t = setTimeout(() => setError(''), 4000)
            return () => clearTimeout(t)
        }
    }, [error])

    const newAdmin = (() => {
        const a = addressInput.trim()
        if (!a || !ethers.isAddress(a)) return null
        return ethers.getAddress(a)
    })()

    const threshold = (() => {
        const n = parseInt(thresholdInput, 10)
        if (!Number.isFinite(n) || n < 1) return null
        return n
    })()

    const handleSubmit = async () => {
        if (!selectedCard || !newAdmin || !threshold) {
            setError('Please select a card, enter a valid EOA address, and threshold (≥1)')
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
                setError('This card is owned by your AA account. Add admin requires the card owner to sign. Please use a card owned by your EOA.')
                setLoading(false)
                return
            }

            const now = Math.floor(Date.now() / 1000)
            const deadline = now + 3600
            const nonce = ethers.hexlify(ethers.randomBytes(32))
            const data = encodeAddAdmin(newAdmin, threshold, metadataInput.trim())

            const ownerSignature = await signExecuteForOwner(
                profile.privateKeyArmor,
                selectedCard.cardAddress,
                data,
                deadline,
                nonce
            )

            const result = await postCardAddAdmin({
                cardAddress: selectedCard.cardAddress,
                data,
                deadline,
                nonce,
                ownerSignature,
            })

            if (result.success && result.hash) {
                setTxHash(result.hash)
                setSuccess(true)
                onSuccess?.()
            } else {
                setError(result.error ?? 'Add admin failed')
            }
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setLoading(false)
        }
    }

    if (success && txHash) {
        return (
            <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
                <BeamioNavBack title="" onClose={onClose} onMore={() => {}} />
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-6">
                        <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Admin added</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">
                        Transaction submitted successfully
                    </p>
                    <div className="w-full max-w-[320px] mb-6">
                        <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Tx Hash</p>
                        <button
                            type="button"
                            onClick={() => openExternalUrl(`${BASE_EXPLORER}${txHash}`)}
                            className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs break-all hover:bg-slate-200 dark:hover:bg-slate-700 w-full text-left"
                        >
                            <span className="truncate">{txHash}</span>
                            <ExternalLink className="w-4 h-4 shrink-0" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full max-w-[320px] h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] active:scale-[0.99]"
                    >{tu('done')}</button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
            <BeamioNavBack title="Add Admin" onClose={onClose} onMore={() => {}} />
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Add an EOA address as admin. AA / smart contract addresses are not allowed.
                </p>

                {/* Select card */}
                <div className="mb-4">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        Card
                    </label>
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
                                        <p className="text-xs text-slate-500 font-mono truncate">
                                            {c.cardAddress.slice(0, 10)}...{c.cardAddress.slice(-8)}
                                        </p>
                                    </div>
                                    <ChevronRight className={cx('w-5 h-5 shrink-0', active ? 'text-[#1D5BFF]' : 'text-slate-400')} strokeWidth={2.2} />
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* New admin address */}
                <div className="mb-4">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        New Admin Address (EOA only)
                    </label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50 font-mono text-sm"
                    />
                </div>

                {/* Metadata (optional) */}
                <div className="mb-4">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        Metadata (optional)
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Partner: Store #001"
                        value={metadataInput}
                        onChange={(e) => setMetadataInput(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50 text-sm"
                    />
                </div>

                {/* Threshold */}
                <div className="mb-6">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        Threshold (required approvals)
                    </label>
                    <input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
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
                    disabled={loading || !newAdmin || !threshold}
                    className={cx(
                        'w-full h-12 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all',
                        loading || !newAdmin || !threshold
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-[#1D5BFF] text-white active:scale-[0.99]'
                    )}
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" strokeWidth={2.2} />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <UserPlus className="w-5 h-5" />
                            Add Admin
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
