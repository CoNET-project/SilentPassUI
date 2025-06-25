

import './index.css'
import { useNavigate } from 'react-router-dom';
import {useState,useRef,useEffect} from 'react'
import { useTranslation } from 'react-i18next'
import Footer from '../../components/Footer'
import { useDaemonContext } from '../../providers/DaemonProvider'
import {aesGcmDecrypt} from '../../services/subscription'
import SimpleLoadingRing from '../../components/SimpleLoadingRing'
import {createOrGetWallet} from '../../services/wallet2backup'
import { listenProfileVer } from "../../services/listeners"

interface backupWord {
	mnemonicPhrase: string
	solanaPrivate: string
}

const BackupSite = () => {
	const [password, setPassword] = useState('')
	const { profiles, backupWord, setProfiles } = useDaemonContext()
	const [showWrodError, setShowWrodError] = useState(false)
	const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState(false)
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const decryptoPassword = async () => {
		setIsRedeemProcessLoading(true)

		const data = await aesGcmDecrypt(backupWord, password)
		setIsRedeemProcessLoading(false)
		if (!data) {
			return setShowWrodError(true)
		}

		try {
			const obj: backupWord = JSON.parse(data)
			await init (obj)
		} catch (ex) {
			return setShowWrodError(true)
		}
	}

	const init = async (obj: backupWord) => {
		if (!obj.mnemonicPhrase ||!obj.solanaPrivate) {
			return setShowWrodError(true)
		}

		const profiles = await createOrGetWallet(obj.mnemonicPhrase, obj.solanaPrivate)
		if (!profiles) {
			return setShowWrodError(true)
		}
		setProfiles(profiles)

		listenProfileVer(setProfiles, ()=> {}, ()=> {})
		navigate('/wallet')
		//await handlePassport ()

	}
	
	return (
		<div className="home" style={{ overflowX: 'hidden' }}>
			<div style={{width: '100%'}}>
				<h2>
					{t('backupHome-title')}
				</h2>
				{
					!backupWord &&
					<h3 style={{color: 'red', padding: '2rem'}}>
						{t('backupHome-Error')}
					</h3>
				}
				{
					backupWord &&
					<div style={{padding: '2rem'}}>
						<input
							type="text"
							placeholder={t('backupHome-password-placeholder')}
							className="redeem-input"
							value={password}
							onChange={(e) => {
								setShowWrodError(false)
								setPassword(e.target.value)
							}}
						/>
						<button className="redeem-button confirm" onClick={decryptoPassword} style={{color: showWrodError ? 'red': 'white'}}>
							{isRedeemProcessLoading ? <SimpleLoadingRing /> : showWrodError ? t('backupHome-password-error') : t('confirm')}
						</button>
					</div>
				}
				
			</div>
			<Footer />
		</div>
	)
}

export default BackupSite