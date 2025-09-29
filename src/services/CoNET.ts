import { conetDepinProvider } from "../utils/constants";
import contracts from "../utils/contracts";

import { ethers, BigNumberish } from "ethers";
const GB_info = contracts.CoNET_GBTotal
const conet_gb_contract = new ethers.Contract(GB_info.address, GB_info.abi, conetDepinProvider)


export const getGB_info = async (): Promise<[BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish]|[]> => {
   
    try {
        const data = await conet_gb_contract.getDashboard()
        return data
    } catch (ex) {
        return []
    }
}

export const getGB_hoistory = async () : Promise<[BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish, BigNumberish]|[]> => {
	try {
        const data = await conet_gb_contract.getDaylyHistory()
        return data
    } catch (ex) {
        return []
    }
}

