import axios, { AxiosResponse } from "axios";
import { ethers } from "ethers";
import { apiv4_endpoint } from "../utils/constants";
import { getCONET_api_health, postToEndpoint } from "../utils/utils";
import nodes from '../pages/Home/assets/allnodes.json'
import {Bridge} from './../bridge/webview-bridge';
// const { ipcRenderer, contextBridge } = require('electron')
// contextBridge.exposeInMainWorld('electronAPI', {
//   sendMessage: (data: any) => ipcRenderer.sendToHost('from-webview', data)
// })
// Create an Axios instance with common configurations

const API_BASE = "http://127.0.0.1:3001"

// 与原生解码结构保持一致
type Node = { host: string; port: number }

export interface StartVPNFromUI {
	entryNodes: Native_node[];
	privateKey: string;
	exitNode: Native_node[];
}

// 工具：带超时的 fetch + JSON
async function fetchJson<T>(
	url: string,
	init?: RequestInit,
	timeoutMs = 8000
	): Promise<T> {
	const ctrl = new AbortController();
	const id = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers || {}),
		},
		signal: ctrl.signal,
		cache: "no-store",
		});
		const data = (await res.json()) as T
		if (!res.ok) {
		throw new Error(`HTTP ${res.status}`)
		}
		return data
	} finally {
		clearTimeout(id)
	}
}

// 启动 VPN：POST /startVPN，服务端回 { ok: boolean }
export async function startVPN(payload: StartVPNFromUI): Promise<boolean> {
  // 通知 UI：开始
	window.dispatchEvent(
		new CustomEvent("vpn:start:request", { detail: payload })
	);

	try {
		const resp = await fetchJson<{ ok: boolean }>(`${API_BASE}/startVPN`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
		// 通知 UI：结果
		window.dispatchEvent(
			new CustomEvent("vpn:start:result", { detail: { ok: resp.ok } })
		);
		return resp.ok === true;
	} catch (e) {
		window.dispatchEvent(
			new CustomEvent("vpn:start:result", { detail: { ok: false, error: String(e) } })
		);
		return false;
	}
}


// 停止 VPN：GET /stopVPN，服务端回 { ok: boolean }
export async function stopVPN(): Promise<boolean> {
	window.dispatchEvent(new CustomEvent("vpn:stop:request"));
	try {
		const resp = await fetchJson<{ ok: boolean }>(`${API_BASE}/stopVPN`);
		window.dispatchEvent(
			new CustomEvent("vpn:stop:result", { detail: { ok: resp.ok } })
		);
		return resp.ok === true;
	} catch (e) {
		window.dispatchEvent(
			new CustomEvent("vpn:stop:result", { detail: { ok: false, error: String(e) } })
		);
		return false;
	}
}


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



// 查询状态：GET /iOSVPN，服务端回 { vpn: boolean }
export async function getiOSVPNStatus(): Promise<boolean|null> {
	try {
		const resp = await fetchJson<{ vpn: boolean }>(`${API_BASE}/iOSVPN`, undefined, 5000);
		// 广播状态给前端 UI
			window.dispatchEvent(new CustomEvent("vpn:status", { detail: resp.vpn }));
		return !!resp.vpn;
	} catch {
		window.dispatchEvent(new CustomEvent("vpn:status", { detail: false }));
		return null;
	}
}

// 查询状态：GET /iOSVPN，服务端回 { vpn: boolean }
export async function getAndroidVPNStatus(): Promise<boolean|null> {
	try {
		const resp = await fetchJson<{ vpn: boolean }>(`http://127.0.0.1:8888/androidVPN`, undefined, 5000);
		// 广播状态给前端 UI
		window.dispatchEvent(new CustomEvent("vpn:status", { detail: resp.vpn }));
		return true;
	} catch {
		window.dispatchEvent(new CustomEvent("vpn:status", { detail: false }));
		return null;
	}
}


export const getLocalServerVersion = async (): Promise<string> => {
	  try {
    const response = await api.get("/ver")
    return response?.data?.ver
  } catch (error) {
    console.error("Error starting silent pass:", error);
    return ''
  }
}

export const getLocalServerVPN = async (): Promise<string> => {
	  try {
    const response = await api.get("/iOSVPN")
    return response?.data?.vpn
  } catch (error) {
    console.error("Error starting silent pass:", error);
    return ''
  }
}

export const iOSstopSilentPass = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/stopVPN");
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
  }
}

export const iOSStartSilentPass = async (data: Native_StartVPNObj): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.post("/startVPN")
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
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
  if(isLocalProxy){
    return Bridge.send('openUrl',{data:url},(res:any)=>{});
  }else {
		window.open(url, '_blank')
	}
}
