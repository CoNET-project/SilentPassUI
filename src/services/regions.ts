import { ethers } from "ethers";
import contracts from "../utils/contracts";
import { conetProvider } from "../utils/constants";

interface regions {
	code: string
	country: string
}
// Get All Regions
export const getAllRegions = async (): Promise<any> => {
  const GuardianNodesInfoV6Contract = new ethers.Contract(
    contracts.GuardianNodesInfoV6.address,
    contracts.GuardianNodesInfoV6.abi,
    conetProvider
  );

  try {
    const regions:string[] = await GuardianNodesInfoV6Contract.getAllRegions();
    return regions;
  } catch (ex) {
    throw ex;
  }
};
