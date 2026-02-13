/**
 * TopUpRedeemForm - Owner 通过离线签名 + API 免 gas 发行 redeem code 空投 token 给用户
 * 流程：选择卡 → 输入 pts → 输入目标用户 EOA → 签名 → 提交 API → 服务端 createRedeem + redeemForUser
 */
import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { Gift, Loader, ChevronRight, AlertCircle } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatAmount } from '@/services/currency'
import {
    signExecuteForOwner,
    postExecuteForOwner,
    encodeCreateRedeem,
    type UserCardInfo,
} from '@/services/BeamioCard'
import { generateCODE } from '@/services/beamio'
import { fiatPrefix } from '@/services/currency'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'

type Props = {
    userCards: UserCardInfo[]
    onClose: () => void
    onSuccess?: () => void
}

const NAV_TOP = 'env(safe-area-inset-top)'

function cx(...v: Array<string | false | undefined | null>) {
    return v.filter(Boolean).join(' ')
}

export default function TopUpRedeemForm({ userCards, onClose, onSuccess }: Props) {
    const { profiles } = useDaemonContext()
    const [selectedCard, setSelectedCard] = useState<UserCardInfo | null>(userCards[0] ?? null)
    const [pointsInput, setPointsInput] = useState('')
    const [toAddress, setToAddress] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [redeemCode, setRedeemCode] = useState<string | null>(null)

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

    const handleSubmit = async () => {
        if (!selectedCard || !points6 || !toAddress.trim()) {
            setError('请选择卡、输入点数及目标地址')
            return
        }
        const addr = toAddress.trim()
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
            setError('目标地址格式不正确')
            return
        }

        const profile = profiles?.[0]
        if (!profile?.privateKeyArmor) {
            setError('请先登录')
            return
        }

        setLoading(true)
        setError('')
        try {
            const { code, hash } = generateCODE('')
            const now = Math.floor(Date.now() / 1000)
            const validAfter = now - 60
            const validBefore = now + 3600
            const deadline = now + 3600
            const nonce = ethers.hexlify(ethers.randomBytes(32))

            const data = encodeCreateRedeem(hash, points6, validAfter, validBefore)
            const ownerSignature = await signExecuteForOwner(
                profile.privateKeyArmor,
                selectedCard.cardAddress,
                data,
                deadline,
                nonce
            )

            const result = await postExecuteForOwner({
                cardAddress: selectedCard.cardAddress,
                data,
                deadline,
                nonce,
                ownerSignature,
                redeemCode: code,
                toUserEOA: addr,
            })

            if (result.success) {
                setRedeemCode(result.code ?? null)
                setSuccess(true)
                onSuccess?.()
            } else {
                setError(result.error ?? '提交失败')
            }
        } catch (e: any) {
            setError(e?.message ?? String(e))
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
                <BeamioNavBack title="" onClose={onClose} onMore={() => {}} />
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-6">
                        <Gift className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">空投成功</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                        已向 {toAddress.slice(0, 10)}...{toAddress.slice(-8)} 空投 {formatAmount(Number(pointsInput), selectedCard?.currency as any)} pts
                    </p>
                    {redeemCode && (
                        <p className="text-xs font-mono text-slate-400 mb-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 break-all">
                            Redeem: {redeemCode}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full max-w-[320px] h-12 rounded-xl bg-[#1D5BFF] text-white font-bold text-[15px] active:scale-[0.99]"
                    >
                        完成
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-0 pb-[env(safe-area-inset-bottom)]">
            <BeamioNavBack title="Top Up（空投）" onClose={onClose} onMore={() => {}} />
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4">
                    通过离线签名，免 gas 向目标用户空投 pts。
                </p>

                {/* 选择卡 */}
                <div className="mb-4">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        选择卡
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

                {/* 点数 */}
                <div className="mb-4">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        空投点数 (pts)
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="例如 100"
                        value={pointsInput}
                        onChange={(e) => setPointsInput(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50"
                    />
                </div>

                {/* 目标地址 */}
                <div className="mb-6">
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
                        目标用户 EOA 地址
                    </label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={toAddress}
                        onChange={(e) => setToAddress(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5BFF]/50"
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
                    disabled={loading || !points6 || !toAddress.trim()}
                    className={cx(
                        'w-full h-12 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all',
                        loading || !points6 || !toAddress.trim()
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-[#1D5BFF] text-white active:scale-[0.99]'
                    )}
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 animate-spin" strokeWidth={2.2} />
                            提交中...
                        </>
                    ) : (
                        '签名并提交'
                    )}
                </button>
            </div>
        </div>
    )
}
