import {
  ClaimableConetPointAbi,
  ConetGuardianNodesV6,
  FaucetV3Abi,
  GuardianNodesInfoV6Abi,
  ConetStorageAbi,
  PassportCancunAbi,
  ConetDepinAbi,
  PassportMainnetAbi,
  SpOracleAbi,
  PurchasePassportAbi,
  Distributor,
  SpClubAbi,
} from "./abis";

const contracts = {
  GuardianNodesInfoV6: {
    address: "0x88cBCc093344F2e1A6c2790A537574949D711E9d",
    abi: GuardianNodesInfoV6Abi,
    network: "CONET Holesky",
  },
  ConetGuardianNodesV6: {
    address: "0x312c96DbcCF9aa277999b3a11b7ea6956DdF5c61",
    abi: ConetGuardianNodesV6,
    network: "CONET Holesky",
  },
  ClaimableConetPoint: {
    address: "0x6C7C575010F86A311673432319299F3D68e4b522",
    abi: ClaimableConetPointAbi,
    network: "CONET Holesky",
  },
  FaucetV3: {
    address: "0x04CD419cb93FD4f70059cAeEe34f175459Ae1b6a",
    abi: FaucetV3Abi,
    network: "CONET Holesky",
  },
  ConetStorage: {
    address: "0x20f8B4De2922d2e9d83B73f4561221d9278Af181",
    abi: ConetStorageAbi,
    network: "CONET Holesky",
  },
  PassportCancun: {
    address: "0xb889F14b557C2dB610f283055A988952953E0E94",
    abi: PassportCancunAbi,
    network: "CONET Holesky",
  },
  PassportMainnet: {
    address: "0x054498c353452A6F29FcA5E7A0c4D13b2D77fF08",
    abi: PassportMainnetAbi,
    network: "CONET DePIN",
  },
  ConetDepin: {
    address: "0xC6edDb4Bc6161259325cf56AEf8b0D4fb289898A",
    abi: ConetDepinAbi,
    network: "CONET DePIN",
  },
  PassportSolana: {
    address: "Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump",
    network: "Solana Mainnet",
  },
  SpOracle: {
    address: "0xA57Dc01fF9a340210E5ba6CF01b4EE6De8e50719",
    abi: SpOracleAbi,
    network: "CONET Holesky",
  },
  PurchasePassport: {
    address: "0xE111F88A0204eE1F5DFE2cF5796F9C2179EeBBDd",
    abi: PurchasePassportAbi,
    network: "CONET Holesky",
  },
  distributor: {
    address: '0x0c0f13c0F336A369142Bd12Ba268BC36e36E3684',
    abi: Distributor
  },
  SpClub: {
    address: "0xe1949263B338D8c1eD7d4CbDE2026eb82DB78D3a",
    abi: SpClubAbi,
    network: "CONET DePIN",
  },
};

export default contracts;
