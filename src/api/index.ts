import axios, { AxiosResponse } from "axios";
import { ethers } from "ethers";
import { apiv4_endpoint } from "../utils/constants";
import { getCONET_api_health, postToEndpoint } from "../utils/utils";
import nodes from '../pages/Home/assets/allnodes.json'
// const { ipcRenderer, contextBridge } = require('electron')
// contextBridge.exposeInMainWorld('electronAPI', {
//   sendMessage: (data: any) => ipcRenderer.sendToHost('from-webview', data)
// })
// Create an Axios instance with common configurations
const api = axios.create({
  baseURL: "http://localhost:3001/", // Replace with your base API URL
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

export const getLocalServerVersion = async (): Promise<string> => {
	  try {
    const response = await api.get("/ver")
    return response?.data?.ver
  } catch (error) {
    console.error("Error starting silent pass:", error);
    return ''
  }
}

export const stopSilentPass = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/stopSilentPass");
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
  }
};

export const sendRule = async (data: string) => {
	try {
		const response = await api.post("/rule", {
			data
		})
		return response;
	} catch (error) {
		console.error("Error starting silent pass:", error);
		throw error;
	}
}

export const getServerIpAddress = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/ipaddress");
    return response;
  } catch (error) {
    console.error("Error fetching ipaddress:", error);
    throw error;
  }
};

export const testRequest = async () => {
	const url = `https://${nodes[0].domain}/silentpass-rpc/`
	axios.get(url).then (res=> {
		const kk = res
	})
}

export const joinSpClub = async (
  conetProfile: profile,
  solanaProfile: profile,
  referrer: string
) => {
  const message = JSON.stringify({
    walletAddress: conetProfile.keyID,
    solanaWallet: solanaProfile.keyID,
    referrer: referrer,
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

export const openWebLinkNative = async (url: string, isIOS: boolean, isLocalProxy: boolean) => {
	if (window?.webkit?.messageHandlers && isIOS && !isLocalProxy) {
		return window?.webkit?.messageHandlers["openUrl"]?.postMessage(url)
	} else 
	//@ts-ignore
	if (window?.AndroidBridge && AndroidBridge?.receiveMessageFromJS) {
		const base = btoa(JSON.stringify({cmd: 'openUrl', data: url}))
		//	@ts-ignore
		return AndroidBridge?.receiveMessageFromJS(base)
	} 
  
		window.open(url, '_blank')
	
}
