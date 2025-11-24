import { useEffect, useRef, useState } from "react";
import Home from '../../components/Home/Home';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {checkStorage, storeSystemData} from '@/services/wallets'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"


const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const init = async () => {
		const CoNETData: encrypt_keys_object = await checkStorage()
		if (!CoNETData?.beamio?.initialLoading) {
			setIsInitialLoading(true)
			setShowBeamioOnboardingModal(true)
		}
	}

	const storageInit = async () => {
		
		setShowBeamioOnboardingModal(false)
		setIsInitialLoading(false)
		
	}
	useEffect(() => {
		init()
  	}, [])
	
    return (
        <>
			{
				showBeamioOnboardingModal ? <BeamioOnboardingModal home={() => {
					storageInit()
				}} />
				: <Home /> 
			}
            
        </>
    )
}

export default HomePage

