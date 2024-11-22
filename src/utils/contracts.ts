import {
  ClaimableConetPointAbi,
  ConetGuardianNodesV6,
  FaucetV3Abi,
  GuardianNodesInfoV6Abi,
} from "./abis";

export const contracts = {
  GuardianNodesInfoV6: {
    address: "0x9e213e8B155eF24B466eFC09Bcde706ED23C537a",
    abi: GuardianNodesInfoV6Abi,
  },
  ConetGuardianNodesV6: {
    address: "0x35c6f84C5337e110C9190A5efbaC8B850E960384",
    abi: ConetGuardianNodesV6,
  },
  ClaimableConetPoint: {
    address: "0xa4b389994A591735332A67f3561D60ce96409347",
    abi: ClaimableConetPointAbi,
  },
  FaucetV3: {
    address: "0x04CD419cb93FD4f70059cAeEe34f175459Ae1b6a",
    abi: FaucetV3Abi,
  },
};
