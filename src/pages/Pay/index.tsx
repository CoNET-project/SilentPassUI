import Check from './Check'
import { useState, useRef, useEffect } from 'react'
import styles from '@/pages/Send/send.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import BeamioPayRequest from './PayRequest'
import { onWalletEvent } from '@/services/beamio'
import PayForm from './PayForm'
import { Button,Modal,Toast } from "antd-mobile"

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
	
	const { darkModle, setDarkModle, setProfiles, power, setPower } = useDaemonContext()
	const [showLinkPay, setShowLinkPay] = useState(false)
	const [code, setCode] = useState('')
	const [note, setNote] = useState('')
	const [amt, setAmt] = useState('')
	const [recipient, setRecipient] = useState('')

	useEffect(() => {

	}, [])


	return (
		<div className={styles.home}>
			
			<div className="px-5 pt-1 flex flex-col gap-2">
				{
					 <BeamioPayRequest />
				}
				
			</div>
			
		</div>
	)
}

export default Pay
