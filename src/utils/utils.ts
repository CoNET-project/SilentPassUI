import { XMLHttpRequestTimeout } from "./constants";
import { contracts } from "./contracts";

export const customJsonStringify = (item: any) => {
  const result = JSON.stringify(
    item,
    (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
  );
  return result;
};

export const initProfileTokens = () => {
  const ret: conet_tokens = {
    cCNTP: {
      balance: "0",
      network: "CONET Holesky",
      decimal: 18,
      contract: contracts.ClaimableConetPoint.address,
      name: "cCNTP",
    },
    conet: {
      balance: "0",
      network: "CONET Holesky",
      decimal: 18,
      contract: "",
      name: "conet",
    },
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

          return resolve(xhr.responseText);
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
