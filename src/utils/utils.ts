import { XMLHttpRequestTimeout } from "./constants";
import contracts from "./contracts";

export const customJsonStringify = (item: any) => {
  const result = JSON.stringify(
    item,
    (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
  );
  return result;
};

export const formatMinutesToHHMM = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:00`;
};

export const initProfileTokens = () => {
  const ret: conet_tokens = {
    // cCNTP: {
    //   balance: "0",
    //   network: "CONET Holesky",
    //   decimal: 18,
    //   contract: contracts.ClaimableConetPoint.address,
    //   name: "cCNTP",
    // },
    conetDepin: {
      balance: "0",
      network: "CONET DePIN",
      decimal: 18,
      contract: contracts.ConetDepin.address,
      name: "conetDepin",
    },
    conet: {
      balance: "0",
      network: "CONET Holesky",
      decimal: 18,
      contract: "",
      name: "conet",
    },
    conet_eth: {
      balance: "0",
      network: "CONET DePIN",
      decimal: 18,
      contract: "",
      name: "conet_eth",
    },
    eth: {
      balance: "0",
      network: "ETH",
      decimal: 18,
      contract: "",
      name: "eth",
    },
	solana: {
	  balance: "0",
	  network: "Solana",
	  decimal: 6,
	  contract: "",
	  name: "solana",
	},
	SP: {
		balance: "0",
		network: "Solana",
		decimal: 6,
		contract: contracts.SP.address,
		name: "SilnetPass",
	}
  };
  return ret;
};

export const postToEndpoint = (url: string, post: boolean, jsonData: any) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      clearTimeout(timeCount);

      if (xhr.status === 200) {
        if (!xhr.responseText.length) {
          return resolve("");
        }

        let ret;

        try {
          ret = JSON.parse(xhr.responseText);
        } catch (ex) {
          if (post) {
            return resolve("");
          }

          return resolve(true);
        }

        return resolve(ret);
      }

      console.log(
        `postToEndpoint [${url}] xhr.status [${
          xhr.status === 200
        }] !== 200 Error`
      );

      return resolve(false);
    };

    xhr.onerror = (err) => {
      console.log(`xhr.onerror`, err);
      clearTimeout(timeCount);
      return reject(err);
    };

    xhr.open(post ? "POST" : "GET", url, true);

    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    xhr.send(jsonData ? JSON.stringify(jsonData) : "");

    const timeCount = setTimeout(() => {
      const Err = `Timeout!`;
      console.log(`postToEndpoint ${url} Timeout Error`, Err);
      reject(new Error(Err));
    }, XMLHttpRequestTimeout);
  });
};

export const getRemainingTime = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000); // Convert current time to seconds
  const diff = timestamp - now;

  if (diff <= 0) return "00:00:00"; // Time has already passed

  const days = Math.floor(diff / 86400); // 86400 seconds in a day
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""} + ${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(2, "0")}h`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

export const parseQueryParams = (queryString: string) => {
  const params = new Map();

  // Remove the leading '?' if present
  const cleanQueryString = queryString.startsWith("?")
    ? queryString.slice(1)
    : queryString;

  // Split the string into key-value pairs
  const pairs = cleanQueryString.split("&");

  for (const pair of pairs) {
    // Split each pair into key and value
    const [key, value] = pair.split("=").map(decodeURIComponent);
    // Only add if key is not undefined
    if (key) {
      params.set(key, value || "");
    }
  }

  return params;
};
