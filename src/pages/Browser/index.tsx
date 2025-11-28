
import { useState, useRef, useEffect } from 'react'
import { onWalletEvent } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import PayForm from '@/pages/Pay/PayForm'
import {getBalance, AuthorizationSign, estimateGasUSDC} from '@/services/beamio'
import {ethers} from 'ethers'
import { useNavigate } from "react-router-dom"


const Browser = ({}) => {
	const navigate = useNavigate()
	const { darkModle, setDarkModle, setProfiles, power, setPower, setUsdcbalance, paymentLink, setPaymentLink } = useDaemonContext()
	
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState(paymentLink?.code)
	const [note, setNote] = useState(paymentLink?.note)
	const [amt, setAmt] = useState(paymentLink?.amount)
	const [recipient, setRecipient] = useState(paymentLink?.address)
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSDAmount, setUsdcToUSDAmount] = useState(0)
	const [processing, setProcessing] = useState(false)
	const [processError, setProcessError] = useState('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [successHash, setSuccessHash] = useState('')
	const [successPayLink, setSuccessPayLink] = useState<string>('')
	const [amount, setAmount] = useState<string|undefined>(amt)
	const [popupOpen, setPopupOpen] = useState(true)
	
	const getBa = async () => {
		if (!myAddress) return
		const _ba = await getBalance(myAddress)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcUsd = usdc * Number(ba.oracle.eth.usdc)
		setUsdcbalance(usdc)
		const total = ethUsd + usdcUsd
		setUsdcToUSDAmount(usdcUsd)
	}
	
	useEffect(() => {

		const url = new URL(window.location.href)
		const codeHash = url.searchParams.get('code')||''
		const amount = url.searchParams.get('amount')||''


		if (codeHash && amount ) {
			setNote(url.searchParams.get('note')||'')
			setRecipient(url.searchParams.get('address')||'')
			setAmt(amount)
			setCode(codeHash)
		}

		if (amount && codeHash && !power) {
			setShowLinkPay(true)
		}

	}, [])

	useEffect(() => {
		if (code && amt) {
			setShowLinkPay(true)
		}
	},[code, amt ])


	const cancel = () => {
		setCode('')
		setAmt('')
		setNote('')
		setRecipient('')
		setPower(true)
		setShowLinkPay(false)
		navigate('/Pay')
		setPaymentLink(null)
	}

    return (
        <>
		{
			showLinkPay ? (
				<PayForm code={code} amt={amt} note={note} recipient={recipient} closeWin={()=> {
					cancel()
				}} />
				) : (
					<div className="relative px-5 pt-6">
						
						{/* 左侧：切换主题按钮 */}
						{/* <button
							type="button"
							className={styles.headerBtn}
							aria-label="Toggle theme"
							onClick={() => setDarkModle(!darkModle)}
						>
							<span className={styles.headerBtnIcon}>
							{darkModle ? <LightDrakMode /> : <LightDrakModeBlue />}
							</span>
						</button> */}

						{/* 右侧：Scan 按钮 */}
						{/* 固定右上角的 ScanBtn */}
						<div className="absolute right-0 pt-6">
							{/* <ScanBtn/> */}
						</div>
					</div>
				)
		}

        </>
    )
};

export default Browser
