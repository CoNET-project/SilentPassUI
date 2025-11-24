import ScanBtn from '@/components/Wallet/scanBtn/ScanButton'
import { useState, useRef, useEffect } from 'react'
import { onWalletEvent } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import PayForm from '@/pages/Pay/PayForm'

const Browser = ({}) => {
	const { darkModle, setDarkModle, setProfiles, power, setPower } = useDaemonContext()
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')
	
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
			}
		})

		if (amount && codeHash && !power) {
			setShowLinkPay(true)
		}

		// 卸载时把监听取消，避免旧实例继续吃事件
		return () => {
			if (typeof off === 'function') off()
		}
	}, [])

    return (
        <>
		{
			showLinkPay ? (
				<PayForm code={code} amt={amt} note={note} recipient={recipient} closeWin={()=> {
					setCode('')
					setAmt('')
					setNote('')
					setRecipient('')
					setPower(true)
					setShowLinkPay(false)
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
