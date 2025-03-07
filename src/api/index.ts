import axios, { AxiosResponse } from "axios";
import { ethers } from "ethers";
import { apiv4_endpoint } from "../utils/constants";
import { getCONET_api_health, postToEndpoint } from "../utils/utils";

// Create an Axios instance with common configurations
const api = axios.create({
  baseURL: "http://localhost:3001", // Replace with your base API URL
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Start Silent Pass
export const startSilentPass = async (
  vpnInfo: Native_StartVPNObj
): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.post("/startSilentPass", {
      vpnInfo: vpnInfo,
    });
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
  }
};

export const stopSilentPass = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/stopSilentPass");
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
  }
};

export const getServerIpAddress = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/ipaddress");
    return response;
  } catch (error) {
    console.error("Error fetching regions:", error);
    throw error;
  }
};

export const joinSpClub = async (
  conetProfile: profile,
  solanaProfile: profile
) => {
  const message = JSON.stringify({
    walletAddress: conetProfile.keyID,
    solanaWallet: solanaProfile.keyID,
    referrer: "",
  });

  const wallet = new ethers.Wallet(conetProfile.privateKeyArmor);
  const signMessage = await wallet.signMessage(message);

  const sendData = {
    message,
    signMessage,
  };

  if (await getCONET_api_health()) {
    const url = `${apiv4_endpoint}spclub`;
    let result = await postToEndpoint(url, true, sendData);

    return result;
  }

  return false;
};
