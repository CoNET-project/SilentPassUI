import { ethers } from "ethers";
import { contracts } from "../utils/contracts";

const conetRpc = "https://rpc.conet.network";
const conetProvider = new ethers.JsonRpcProvider(conetRpc);

// Get All Regions
export const getAllRegions = async (): Promise<any> => {
  const GuardianNodesInfoV6Contract = new ethers.Contract(
    contracts.GuardianNodesInfoV6.address,
    contracts.GuardianNodesInfoV6.abi,
    conetProvider
  );

  try {
    const regions = await GuardianNodesInfoV6Contract.getAllRegions();
    return regions;
  } catch (ex) {
    throw ex;
  }
};
