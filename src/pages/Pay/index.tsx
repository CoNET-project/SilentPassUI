
import { useState, useRef, useEffect } from 'react'
import styles from '@/pages/History/send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { createPortal } from 'react-dom';
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import { onWalletEvent, searchUsername } from '@/services/beamio'
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
import Cashcode from './Cashcode'
import PayMe from './PayMe'
import { useNavigate } from "react-router-dom"
import {ethers} from 'ethers'
import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
import BeamioPayMe from './BeamioPayMe'
type Props = {
	amount: string
	noteText: string
	recipientADDR: string
	codeHASH: string
}

const beamioConetContract = {
	address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
	network: 'CONET DePIN',
	abi: beamioConetCoreABI,
	provider: new ethers.JsonRpcProvider('https://mainnet-rpc.conet.network'),
	
}
const CoreContract = new ethers.Contract(beamioConetContract.address, beamioConetContract.abi, beamioConetContract.provider)

const Pay = ({}) => {
	const spSendRef=useRef()
	const solSendRef=useRef()
	const usdtSendRef=useRef()
	const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<'Pay'|''|'PayRequest'|'Cashcode'|'payme'>('')
	const { darkModle, setDarkModle, setProfiles, power, setPower, setSendToMemo, setPaymentLink, setSecureCode, setRedeemCode, setPaymentLinkCode,
		setPayMePayment
	} = useDaemonContext()
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [openSearch, setOpenSearch]= useState(false)
	const [userPreviewItem, setUserPreviewItem] = useState<searchResult|null>()
	const navigate = useNavigate()
	type Action = 'pay' | 'cashcode' | 'request-link' | 'payme-qr'

	const checkUrl = async (url: string) => {
	
		const u = new URL(url)
		let searchParams: URLSearchParams
		try {
			const u = new URL(url)
			searchParams = u.searchParams
		} catch {
			searchParams = new URLSearchParams(url)
		}

		let code = searchParams.get("code")||''
		const _secureCode = searchParams.get("secureCode")||searchParams.get("securecode")||''
		const cashcode = searchParams.get("cashcode")||''
		const _beamio = searchParams.get("beamio")||''
		if (_beamio) {
			
			const user = await searchUsername(_beamio)
			const results: searchResult[] = user?.results
			if (!results.length) {
				return
			}
			const filtered = results.filter(n => n.username === _beamio)
			if (!filtered.length) {
				return
			}

			setPayMePayment(filtered[0])
			return navigate('/browser')

		}

		if (_secureCode) {
			setSecureCode (_secureCode)
			setRedeemCode(cashcode)
			return navigate('/browser')
		}

		if (code) {

			if (!code.startsWith('0x')) {
				code = ethers.solidityPackedKeccak256(['string'], [code])
				
			}
			try {
				const fx = await CoreContract.getLinkMemo(code)
				if (fx.to !== ethers.ZeroAddress && fx.amount > BigInt(0)) {
					setPaymentLinkCode(code)
					return navigate('/browser')
				}
				
			} catch (ex) {
				console.log(`await CoreContract.getLinkMemo(code) Error`)
			}
			
			
		}


	}

	useEffect(() => {

		const off = onWalletEvent("scan:url", (url: string) => {
			if (/^0x/i.test(url)) {
				setPaymentLink({code: '', note: '', address: url, amount: ''})
				
				setSendToMemo(url)
				navigate('/Pay')
				return 
			}
			checkUrl(url)
		})
				// 卸载时把监听取消，避免旧实例继续吃事件
		return () => {
			if (typeof off === 'function') off()
		}
	}, [])


	return (
		<div className="
			flex justify-center
			pt-[calc(env(safe-area-inset-top)+0.2rem)]
		">
			<div className="w-full max-w-[620px] px-4 flex flex-col">
				{/* Search */}
			<div className="flex items-center gap-2 mb-4 mt-4">
				<button 
					onClick={() => {
						setOpenSearch(true)
					}}
					className="w-full"
				>
					<div className="pointer-events-none">
						<SearchInputWithDropdown
							showHistory={false}
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
				<div className="grid grid-cols-1 gap-3 mt-4">
					<MainScreen onAction={val => {
						switch(val) {
							case 'cashcode': {
								return setShowAlphaHowItWorks('Cashcode')
							}
							case 'pay': {
								return setShowAlphaHowItWorks('Pay')
							}
							case 'payme-qr': {
								return setShowAlphaHowItWorks('payme')
							}
							default: {
								setShowAlphaHowItWorks('PayRequest')
							}

						}
					}} />
				</div>
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
							showAlphaHowItWorks === 'PayRequest' ? 'Request' : 
							showAlphaHowItWorks === 'Cashcode' ? 'Cashcode' : 'Pay Me'
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
								showAlphaHowItWorks === 'PayRequest' && <BeamioPayMe payLink={''} />
							}
							{
								showAlphaHowItWorks === 'Cashcode' && <Cashcode close={( )=> setShowAlphaHowItWorks('')} />
							}
							{
								showAlphaHowItWorks === 'payme' && <PayMe />
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
