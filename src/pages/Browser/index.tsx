
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
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	const [myAddress, setMyAddress] = useState('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSDAmount, setUsdcToUSDAmount] = useState(0)
	const [processing, setProcessing] = useState(false)
	const [processError, setProcessError] = useState('')
	const [signx402Show, setSignx402Show] = useState(false)
	const [successHash, setSuccessHash] = useState('')
	const [successPayLink, setSuccessPayLink] = useState<string>('')
	const [amount, setAmount] = useState<string|undefined>(amt)

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
		//setPaymentLink({code, note: _note, address, amount})
		if (paymentLink) {
			const payLi = paymentLink
			setCode(payLi?.code)
			setNote(payLi?.note)
			setAmt(payLi?.amount)
			setRecipient(payLi?.address)
			if (payLi?.amount && payLi?.code) {
				setShowLinkPay(true)
			}
			
		}
	},[paymentLink])
	
	useEffect(() => {

		const url = new URL(window.location.href)
		const codeHash = url.searchParams.get('code')||''
		const amount = url.searchParams.get('amount')||''
		setAmt(amount)
		setCode(codeHash)
		setNote(url.searchParams.get('note')||'')
		setRecipient(url.searchParams.get('address')||'')
		

		// 只在挂载时注册一次
		const off = onWalletEvent("scan:url", (url: string) => {

			//		address
			if (/^0x/.test(url)) {
				setPaymentLink({code: '', note: '', address: url, amount: ''})
				return setShowLinkPay(true)
			}

			if (/^http/i.test(url)) {
							// 如果 url 是完整链接，建议这样解析
				let searchParams: URLSearchParams
				try {
					const u = new URL(url)
					searchParams = u.searchParams
				} catch {
					searchParams = new URLSearchParams(url)
				}

				const code = searchParams.get("code")
				const _note = searchParams.get("note")
				const address = searchParams.get("address")
				const amount = searchParams.get("amount")

				if (code) {
					
					setCode(code)
					setNote(_note || '')
					setAmt(amount || '0.00')
					setRecipient(address || '')
					setShowLinkPay(true)
					setPaymentLink({code, note: _note, address, amount})
				}
			}

		})



		if (amount && codeHash && !power) {
			setShowLinkPay(true)
		}

		window.addEventListener("sign:final", onSignFinal)


		// 卸载时把监听取消，避免旧实例继续吃事件
		return () => {
			window.removeEventListener("sign:final", onSignFinal)
			if (typeof off === 'function') off()
		}
	}, [])

	const onSignFinal = async (e: any) => {
		
		const { action, messageDataRe } = e.detail || {}

		if (action === "sign") {
			console.log("✅ 用户点击签名")
			return signRequest(messageDataRe)
		}
		setProcessing(false)
		console.log("❌ 用户取消签名")
		cancel()

	}

	const final = (hash: any) => {
		if (!hash) {
			return 
		}
		
		setSuccessHash(hash.USDC_tx)
		console.log(hash)
		getBa()
	}

	const signRequest = async (messageDataRe: any) => {
		setProcessing (true)
		
		const paymentHeader = await AuthorizationSign(messageDataRe.maxAmountRequired, messageDataRe.payTo)
		const newInit = {
			method: 'GET',
			headers: {
				
				"X-PAYMENT": paymentHeader,
				"Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE"
			},
			__is402Retry: true
		}

		const reqUrl = messageDataRe.reqUrl
		try {
			const secondResponse = await fetch(reqUrl, newInit)
			const body = await secondResponse.json()
			console.log(secondResponse.ok)
			setProcessing (false)
			if (!secondResponse.ok) {
				return setProcessError('RPC Error!')
			}
			const _amount = Number(ethers.formatUnits(messageDataRe.maxAmountRequired, 6)).toFixed(2)
			setAmount (_amount)

			
			setSignx402Show(false)
			return setSuccessPayLink(body.USDC_tx)
		} catch (ex) {
			setProcessing (false)
			return setProcessError('RPC Error!')
			
		}

	}

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
