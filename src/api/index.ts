import axios, { AxiosResponse } from "axios";

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
