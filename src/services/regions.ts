import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { conetDepinProvider, conetDepinProviderFallback } from "../utils/constants";

interface regions {
	code: string
	country: string
}

const guardianContract = (provider: ethers.Provider) =>
  new ethers.Contract(
    contracts.GuardianNodesInfoV6.address,
    contracts.GuardianNodesInfoV6.abi,
    provider
  );

// Get All Regions — CoNET L1 GuardianNodesInfoV6 (rpc1 → publicrpc)
export const getAllRegions = async (): Promise<any> => {
  try {
    const regions: string[] = await guardianContract(conetDepinProvider).getAllRegions();
    return regions;
  } catch (ex) {
    console.warn('[DePIN] getAllRegions rpc1 failed, retrying publicrpc…', (ex as Error)?.message || ex)
    try {
      return await guardianContract(conetDepinProviderFallback).getAllRegions();
    } catch (ex2) {
      throw ex2;
    }
  }
};
