
import { useState, useRef, useEffect } from 'react'
import styles from '@/pages/History/send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { createPortal } from 'react-dom';
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import { onWalletEvent } from '@/services/beamio'
import { Button,Modal,Toast } from "antd-mobile"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import ScanBtn from '@/components/scanBtn/ScanButton'
import BeamioSearch from '@/components/Home/BeamioSearch'
import { ChevronRight } from 'lucide-react'
import MainScreen from './MainScreen'
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import {motion, AnimatePresence } from "framer-motion"
import PayScreen from '@/pages/Pay/send'
import PaymentLink from './PaymentLink'

type Props = {
	amount: string
	noteText: string
	recipientADDR: string
	codeHASH: string
}

const Pay = ({}) => {
	const spSendRef=useRef()
	const solSendRef=useRef()
	const usdtSendRef=useRef()
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'Pay'|''|'PayRequest'>('')
	const { darkModle, setDarkModle, setProfiles, power, setPower } = useDaemonContext()
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [openSearch, setOpenSearch]= useState(false)
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	type Action = 'pay' | 'cashcode' | 'request-link' | 'payme-qr'
	useEffect(() => {

	}, [])


	return (
		<div className={styles.home}>
			
			{/* Search */}
			<div className="flex items-center gap-2 mb-4 mt-10">
					<button 
					onClick={() => {
						setOpenSearch(true)
					}}
					className="w-full"
				>
					<div className="pointer-events-none">
						<SearchInputWithDropdown
							showHistory={false}
							readonly={true}
							close={ path => {
								setShowAlphaHowItWorks('')
							}}
						/>
					</div>
				</button>
				<div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
					<ScanBtn />
				</div>

				
			</div>
			<div className="grid grid-cols-1 gap-3 mt-10">
				<MainScreen onAction={val => {
					switch(val) {
						case 'cashcode': {
							return
						}
						case 'pay': {
							return setShowAlphaHowItWorks('Pay')
						}
						case 'payme-qr': {
							return 
						}
						default: {
							setShowAlphaHowItWorks('PayRequest')
						}

					}
				}} />
			</div>
			<div
				className={`
					fixed inset-0 z-50
					bg-white
					transition-transform duration-100 ease-out
					${ openSearch ? 'translate-y-0' : 'translate-y-full'}
				`}
			>
				<BeamioSearch close={(item) => {
					if (!item || typeof item === 'string') {
						setOpenSearch(false)
					} else {
						setUserPreviewItem(item)
						setShowAlphaHowItWorks('Pay')
					}
					
				} }/>
			</div>
			{showAlphaHowItWorks && createPortal(
				<AnimatePresence>
					<motion.div
						key="modal-overlay"
						className="
							fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						onTouchMove={(e) => e.stopPropagation()}
					>
					{/* 顶部 Header */}
					<BeamioNavBack
						title={
							showAlphaHowItWorks === 'Pay' ? 'Pay':
							showAlphaHowItWorks === 'PayRequest' ? 'Payment Request' : 
							''
						}
						onClose={() => {
							setShowAlphaHowItWorks('')
						}}
					/>

						{/* 内容区域 */}
						<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
							{
								showAlphaHowItWorks === 'Pay' && <PayScreen close={() => {
									setShowAlphaHowItWorks('')
								}}/>
							}
							{
								showAlphaHowItWorks === 'PayRequest' && <PaymentLink close={() => setShowAlphaHowItWorks('')} />
							}
							
						</div>
					</motion.div>
				</AnimatePresence>
				, document.body
			)}
		</div>
	)
}

export default Pay
