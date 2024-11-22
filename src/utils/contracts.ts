import {
  ClaimableConetPointAbi,
  ConetGuardianNodesV6,
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
};
