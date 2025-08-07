import { useEffect, useRef, useState } from "react";
import WalletDetail from '../../components/Wallet/WalletDetail';
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "../../utils/globals";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfoInChain, getAllPassports } from "../../services/wallets";
import { listenProfileVer } from "../../services/listeners";

const Wallet = ({}) => {
	const { setProfiles, setMiningData, setActivePassportUpdated, setActivePassport, setDuplicateAccount } = useDaemonContext();
	
	
	const handlePassport = async () => {
		let handlePassportProcess = false
		if (!CoNET_Data?.profiles[0]?.keyID) return
		if (handlePassportProcess) {
			return
		}
		handlePassportProcess = true

		const info = await getCurrentPassportInfoInChain()
		
		const tmpData = CoNET_Data;

		if (!tmpData) {
			return;
		}

		if (info && tmpData.duplicateAccount) {
			tmpData.profiles[0] = {
				...tmpData?.profiles[0],
				activePassport: {
					nftID: info.nftIDs,
					expires: info.expires,
					expiresDays: info.expiresDays,
					premium: info.premium
				},
			};
		}


		setActivePassport(tmpData.profiles[0].activePassport);

		setCoNET_Data(tmpData);
		setDuplicateAccount(tmpData.duplicateAccount)

		if (!CoNET_Data) return;
		
		setProfiles(CoNET_Data?.profiles);
		setActivePassportUpdated(true);
		handlePassportProcess = false
		listenProfileVer(setProfiles, setActivePassport, setMiningData)
  	}

	useEffect(() => {
		handlePassport()
	}, [])

    return (
        <>
            <WalletDetail />
        </>
    )
}

export default Wallet