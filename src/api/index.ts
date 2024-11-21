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
  countryCode: string
): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.post("/startSilentPass", {
      selectedCountry: countryCode, // Pass the selected country in the request body
    });
    return response;
  } catch (error) {
    console.error("Error starting silent pass:", error);
    throw error;
  }
};

// Get All Regions
export const getAllRegions = async (): Promise<AxiosResponse<any>> => {
  try {
    const response = await api.get("/getAllRegions");
    return response;
  } catch (error) {
    console.error("Error fetching regions:", error);
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
