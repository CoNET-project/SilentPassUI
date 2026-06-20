
import { useState, useEffect } from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { createPortal } from 'react-dom'
import { onWalletEvent, searchUsername } from '@/services/beamio'
import BeamioSearch from '@/components/Home/BeamioSearch'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { motion, AnimatePresence } from 'framer-motion'
import PayScreen from '@/pages/Pay/send'
import Cashcode from './Cashcode'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { getDeprecatedBeamioConetLinkMemo } from '@/utils/deprecatedBeamioConet'
import BeamioPayMe from './BeamioPayMe'
import PaymentWithNfc from './PaymentWithNfc'
import ActiveHistoryPannelNew from '@/pages/History/components/activeHistoryPannelNew'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { tu } from '@/locale/beamioLocale'

const PAY_FLOATING_TOP_CONTROLS_FALLBACK_SPACE = 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 12rem)'

const Pay = ({}) => {
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<
		'支付' | '' | '收款请求' | 'Cashcode' | 'payme' | 'PaymentNFC'
	>('')
	const {
		setSendToMemo,
		setPaymentLink,
		setSecureCode,
		setRedeemCode,
		setPaymentLinkCode,
		setPayMePayment,
	} = useDaemonContext()
	const [openSearch, setOpenSearch] = useState(false)
	const navigate = useNavigate()
	const {
		opacity: topControlsOpacity,
		onScroll: onPayScroll,
		setRef: setPayScrollRef,
	} = useScrollCapsuleOpacity(!openSearch)
	const [topControlsSpacePx, setTopControlsSpacePx] = useState(0)

	const checkUrl = async (url: string) => {
		let searchParams: URLSearchParams
		try {
			const u = new URL(url)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(url)
		}

		let code = searchParams.get('code') || ''
		const _secureCode = searchParams.get('secureCode') || searchParams.get('securecode') || ''
		const cashcode = searchParams.get('cashcode') || ''
		const _beamio = searchParams.get('beamio') || ''
		if (_beamio) {
			const user = await searchUsername(_beamio)
			const results: searchResult[] = user?.results ?? []
			if (!results.length) {
				return
			}
			const filtered = results.filter((n) => n.username === _beamio)
			if (!filtered.length) {
				return
			}

			setPayMePayment(filtered[0])
			return navigate('/browser')
		}

		if (_secureCode) {
			setSecureCode(_secureCode)
			setRedeemCode(cashcode)
			return navigate('/browser')
		}

		if (code) {
			if (!code.startsWith('0x')) {
				code = ethers.solidityPackedKeccak256(['string'], [code])
			}
			try {
				const fx = await getDeprecatedBeamioConetLinkMemo(code)
				if (fx.to !== ethers.ZeroAddress && fx.amount > BigInt(0)) {
					setPaymentLinkCode(code)
					return navigate('/browser')
				}
			} catch {
				console.log(`await CoreContract.getLinkMemo(code) Error`)
			}
		}
	}

	useEffect(() => {
		const off = onWalletEvent('scan:url', (url: string) => {
			if (/^0x/i.test(url)) {
				setPaymentLink({ code: '', note: '', address: url, amount: '' })

				setSendToMemo(url)
				navigate('/Pay')
				return
			}
			checkUrl(url)
		})
		return () => {
			if (typeof off === 'function') off()
		}
	}, [])

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-[#F2F2F7] dark:bg-slate-950">
			{/* 与 Home「View all」同内容的完整 Recent Activity */}
			<div
				ref={setPayScrollRef}
				onScroll={onPayScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-28"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{ minHeight: topControlsSpacePx > 0 ? `${topControlsSpacePx}px` : PAY_FLOATING_TOP_CONTROLS_FALLBACK_SPACE }}
				/>
				<div className="px-4 pb-6">
					<ActiveHistoryPannelNew
						title={tu('recent_activity')}
						compact={false}
						bare
						hideAccountScopeCapsule
						floatingTopControlsOpacity={topControlsOpacity}
						onFloatingTopControlsSpaceChange={(spacePx) => {
							setTopControlsSpacePx((prev) => (Math.abs(prev - spacePx) > 1 ? spacePx : prev))
						}}
						sectionTitleClassName="text-lg font-bold tracking-tight text-[#0F172A] dark:text-slate-100"
					/>
				</div>
			</div>

			<div
				className={`
					fixed inset-0 z-50
					bg-white
					transition-transform duration-100 ease-out
					${openSearch ? 'translate-y-0' : 'translate-y-full'}
				`}
			>
				<BeamioSearch
					close={(item) => {
						setOpenSearch(false)
						if (item && typeof item !== 'string') {
							setShowAlphaHowItWorks('支付')
						}
					}}
				/>
			</div>
			{showAlphaHowItWorks &&
				createPortal(
					<AnimatePresence>
						<motion.div
							key="modal-overlay"
							className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900"
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ duration: 0.2, ease: 'easeOut' }}
							onTouchMove={(e) => e.stopPropagation()}
						>
							<BeamioNavBack
								title={
									showAlphaHowItWorks === '支付'
										? ''
										: showAlphaHowItWorks === '收款请求'
											? tu('request')
											: showAlphaHowItWorks === 'Cashcode'
												? 'Cashcode'
												: showAlphaHowItWorks === 'PaymentNFC'
													? tu('paymentnfc')
													: tu('pay_me')
								}
								onClose={() => {
									setShowAlphaHowItWorks('')
								}}
								onMore={() => {}}
							/>

							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
								{showAlphaHowItWorks === '支付' && (
									<PayScreen
										close={() => {
											setShowAlphaHowItWorks('')
										}}
									/>
								)}
								{showAlphaHowItWorks === '收款请求' && <BeamioPayMe />}
								{showAlphaHowItWorks === 'Cashcode' && (
									<Cashcode close={() => setShowAlphaHowItWorks('')} />
								)}
								{showAlphaHowItWorks === 'PaymentNFC' && (
									<PaymentWithNfc onClose={() => setShowAlphaHowItWorks('')} />
								)}
							</div>
						</motion.div>
					</AnimatePresence>,
					document.body
				)}
		</div>
	)
}

export default Pay
