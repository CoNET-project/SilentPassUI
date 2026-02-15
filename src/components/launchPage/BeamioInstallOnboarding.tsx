import React, { useState, useEffect } from "react";
import { checkStorage } from '@/services/beamio'
import BeamioOnboardingModal from '@/pages/Home/LoadingPage'
import SplashScreen from '@/components/SplashScreen'
import { useNavigate } from 'react-router-dom'

const BeamioInstallOnboarding: React.FC = () => {
	const [splashVisible, setSplashVisible] = useState(true)
	const navigate = useNavigate()

	useEffect(() => {
		const run = async () => {
			const CoNETData = await checkStorage()
			if (CoNETData && CoNETData?.beamio) {
				setSplashVisible(false)
				navigate('/')
				return
			}
			setSplashVisible(false)
		}
		run()
	}, [navigate])

	return (
		<>
			{splashVisible && <SplashScreen />}
			<BeamioOnboardingModal
				home={() => window.location.reload()}
				onInitComplete={() => setSplashVisible(false)}
			/>
		</>
	)
}

export default BeamioInstallOnboarding
