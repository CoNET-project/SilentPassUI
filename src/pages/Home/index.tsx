import { useEffect, useRef, useState } from "react";
import Home from '../../components/Home/Home';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading } = useDaemonContext()
    return (
        <>
			{
				isInitialLoading ? <BeamioOnboardingModal home={() => {
					setIsInitialLoading(false)
				}} />
				: <Home /> 
			}
            
        </>
    )
}

export default HomePage

