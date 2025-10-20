import bs58 from "bs58"
import { Keypair } from "@solana/web3.js";
import { apiv4_endpoint, XMLHttpRequestTimeout } from "./constants";
import contracts from "./contracts";


enum PassportTitle {
  Placeholder = '...',
  Freemium   = 'passport_Freemium',    // "Free Trial"
  Guardian   = 'passport_Guardian',    // "Guardian"
  Annually   = 'passport_Annually',    // "Annually"
  Quarter    = 'passport_Quarter',     // "Quarter"
  Monthly    = 'passport_Monthly',     // "Monthly"
  Infinite   = 'passport_Infinite',    // "Infinite"
  Unlimit    = 'passport_unlimit',     // "Unlimited"
}

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
    cCNTP: {
      balance: "0",
      network: "CONET Holesky",
      decimal: 18,
      contract: contracts.ClaimableConetPoint.address,
      name: "cCNTP",
    },
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
    sol: {
      balance: "0",
      network: "Solana Mainnet",
      decimal: 18,
      contract: "",
      name: "sol",
    },
	sGB: {
      balance: "0",
      network: "CONET DePIN",
      decimal: 9,
      contract: contracts.sGB.address,
      name: "sGB",
    },
    sp: {
      balance: "0",
      network: "Solana Mainnet",
      decimal: 18,
      contract: contracts.SPToken.address,
      name: "sp",
    },
    usdt: {
      balance: "0",
      network: "Solana Mainnet",
      decimal: 18,
      contract: "",
      name: "usdt",
    },
  };
  return ret;
};

export const postToEndpoint = async <T = any>(
  url: string,
  post: boolean,
  jsonData?: any,
  timeoutMs = typeof XMLHttpRequestTimeout === "number" ? XMLHttpRequestTimeout : 15000,
  opts?: { signal?: AbortSignal }            // 可选：外部取消
): Promise<"" | boolean | T> => {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onAbort: (() => void) | null = null;

  const cleanup = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (onAbort && opts?.signal) {
      opts.signal.removeEventListener("abort", onAbort);
      onAbort = null;
    }
  };

  try {
    // A) 内部超时
    timer = setTimeout(() => {
      try {
        // 统一抛出 AbortError；部分环境会把 reason 透传到异常里
        ac.abort(new DOMException("Timeout", "TimeoutError"));
      } catch {
        ac.abort("TimeoutError" as any);
      }
    }, timeoutMs);

    // B) 外部 signal 联动
    if (opts?.signal) {
      if (opts.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      onAbort = () => {
        try {
          ac.abort((opts.signal as any).reason ?? new DOMException("Aborted", "AbortError"));
        } catch {
          ac.abort();
        }
      };
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    const res = await fetch(url, {
      method: post ? "POST" : "GET",
      headers:
        post && jsonData !== undefined
          ? { "Content-Type": "application/json;charset=UTF-8" }
          : undefined,
      body: post ? (jsonData ? JSON.stringify(jsonData) : "") : undefined,
      signal: ac.signal,
      // 防线 A：禁用重定向与缓存，避免被门户/代理“成功”掉
      redirect: "manual",
      cache: "no-store",
      // 依需求选择；很多门户依赖 Cookie，这里可隔离
      credentials: "omit",
    });

    // 非 2xx → false
    if (res.status < 200 || res.status >= 300) {
      return false;
    }

    const text = await res.text();
    if (!text.length) {
      return "";
    }

    // 优先依据 Content-Type
    const ct = (res.headers.get("Content-Type") || "").toLowerCase();
    if (ct.includes("application/json") || ct.includes("+json")) {
      return JSON.parse(text) as T;
    }

    // 回落：尝试 JSON 解析；失败时保持原规则（POST→""，GET→true）
    try {
      return JSON.parse(text) as T;
    } catch {
      return (post ? "" : true) as any;
    }
  } catch (err) {
    // 包含 AbortError/网络错误等 → 交由上层处理
    throw err;
  } finally {
    cleanup();
  }
};


export const getRemainingTime = (timestamp: number, day: string, hour: string): string => {
  const now = Math.floor(Date.now() / 1000);
  let diff = timestamp - now;
  if (diff <= 0) return `0m0s`;

  const days = Math.floor(diff / 86400);
  diff %= 86400;
  const hours = Math.floor(diff / 3600);
  diff %= 3600;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;

  if (days >= 1) {
    // 0d00h
    return `${days}d ${hours}h`;
  }

  if (hours >= 1) {
    // 00h00m
    return `${hours}h ${minutes}m`;
  }

  // 00m00s
  return `00m ${seconds}s`;
};

export const isPassportValid = (expires: number | undefined) => {
  if (!expires) return false;
  if (expires > 4900000000) return true;

  const now = Math.floor(Date.now());
  const expiresDate = new Date(expires * 1000);

  return expiresDate.getTime() > now
}

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
}

export const isInfinite = (passportInfo: any) => {
		if (!passportInfo|| parseInt(passportInfo.nftID) < 100) {
		return false
	}
	
	if (passportInfo.expiresDays < 30 && passportInfo.expiresDays > 0){
		return false
	}

	if (passportInfo?.expires > 32503690800000 || passportInfo.expiresDays > 366) {
		return true
	}

  	return false
}


// Returns the title of the passport based on the provided passportInfo
// Must be called within in t('') when called for localization
export const getPassportTitle = (passportInfo: any) => {
  if (!passportInfo || parseInt(passportInfo.nftID, 10) < 100) {
    return PassportTitle.Freemium;
  }

  const { expires, expiresDays } = passportInfo;

  if (expiresDays > 366) {
    return PassportTitle.Infinite;
  }

  if (expires > 32_503_690_800_000) {  // year 3000-ish
    return PassportTitle.Guardian;
  }

  if (expiresDays > 100) {
    return PassportTitle.Annually;
  }

  if (expiresDays > 90) {
    return PassportTitle.Quarter;
  }

  if (expiresDays > 0 && expiresDays < 30) {
    return PassportTitle.Freemium;
  }

  return PassportTitle.Monthly;
};

export const getExpirationDate = (passportInfo: any, unlimit: string, not_used: string, day: string, hour: string) => {
  if (passportInfo?.expires && passportInfo?.expires > 4900000000) {
    return unlimit;
  }

  if (passportInfo?.expires === 0) {
    return not_used;
  }

  if (passportInfo?.expires)
    return `${getRemainingTime(passportInfo?.expires, day, hour)}`;
};

export const getPlanDuration = (passportInfo: any) => {
  if (String(passportInfo?.expiresDays) === "7") return "Free for 7 days";
  if (String(passportInfo?.expiresDays) === "30") return "Monthly Plan";
  if (String(passportInfo?.expiresDays) === "365") return "Yearly Plan";
  if (String(passportInfo?.expiresDays) > "365") return "Unlimited";
  if (String(passportInfo?.expiresDays) === "0") return "";
};

export const calcSpInUsd = (sp9999: string) => {
  const sp9999Number = Number(sp9999)
  const _spInUsd = 99.99 / sp9999Number
  return _spInUsd
}

export function isValidSolanaBase58PrivateKey(base58Key: string) {
  try {
    // Decode Base58 string to Uint8Array
    let privateKey = bs58.decode(base58Key);

    // Check if it's 64 bytes (Ed25519 private key length)
    if (privateKey.length !== 64) {
      console.error("Invalid private key length:", privateKey.length);
      return false;
    }

    // Attempt to create a Keypair
    let keypair = Keypair.fromSecretKey(privateKey);

    console.log("Valid private key! Public Key:", keypair.publicKey.toBase58());
    return true;
  } catch (error) {
    console.error("Invalid Private Key:", error);
    return false;
  }
}

const insertCommas = (str: string): string => {
  const [intPart, decimalPart] = str.split('.')
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decimalPart ? '.' + decimalPart : '')
}

export const parseFormattedNumber = (str: string): number => {
  const cleanStr = str.replace(/,/g, '').trim().toUpperCase()
  if (cleanStr.endsWith('K')) {
    return parseFloat(cleanStr.slice(0, -1)) * 1_000
  } else if (cleanStr.endsWith('M')) {
    return parseFloat(cleanStr.slice(0, -1)) * 1_000_000
  } else {
    return parseFloat(cleanStr)
  }
}

export const formatNumber = (_value: string): string => {
  const value = parseFloat(_value)
  if (value >= 1_000_000_000) {
    const millions = value / 1_000_000
    return insertCommas(millions.toFixed(1)) + 'M'
  } else if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M'
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K'
  } else {
    return value.toFixed(4)
  }
}



export const getCONET_api_health = async () => {
  const url = `${apiv4_endpoint}health`;
  const result: any = await postToEndpoint(url, false, null);
  if (result?.health === true) {
    return true;
  }
  return false;
};


type FindResult<R> = { index: number; value: R } | null;

export async function findAsync<T, R>(
  items: readonly T[],
  worker: (item: T, ctx: { index: number; signal: AbortSignal }) => Promise<R | undefined>,
  opts?: { concurrency?: number }
): Promise<FindResult<R>> {
  const concurrency = Math.max(1, opts?.concurrency ?? 4);
  if (items.length === 0) return null;

  let next = 0;
  let found: FindResult<R> = null;
  let stopped = false;

  // 所有 worker 共享一个 AbortController，用于全局早停
  const controller = new AbortController();
  const { signal } = controller;

  // 跑一个工作单元
  const runOne = async () => {
    while (!stopped) {
      const i = next++;
      if (i >= items.length) return; // 没活了

      try {
        const maybe = await worker(items[i], { index: i, signal });
        if (maybe !== undefined && !stopped) {
          found = { index: i, value: maybe };
          stopped = true;
          controller.abort();       // 通知其它在途任务终止
          return;
        }
      } catch (err) {
        // 被 abort 时，很多 I/O 会抛 AbortError，这里静默即可
        // 你也可以按需记录非 Abort 的错误
        if (!(err instanceof Error && (err as any).name === 'AbortError')) {
          // console.debug('worker error @', i, err);
        }
        if (stopped) return;
      }
    }
  };

  // 启动有上限的 worker 池
  const runners: Promise<void>[] = [];
  for (let k = 0; k < Math.min(concurrency, items.length); k++) {
    runners.push(runOne());
  }
  await Promise.allSettled(runners); // 等全部收尾（或被早停）

  return found;
}