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
	SpReword,
	ReferralsV3,
	SpClubPoint,
	Duplicate,
	sGB,
	sGB_Dashboard,
	SGB_Airdrop
  } from "./abis";
  
  const contracts = {
	GuardianNodesInfoV6: {
	  // CoNET L1 224422 canonical — sync with x402sdk / SilentPassUI CONET_GUARDIAN_NODES_INFO_V6
	  address: "0xBC6b53065b5647261396d002bDBA0d3396E0722f",
	  abi: GuardianNodesInfoV6Abi,
	  network: "CONET DePIN",
	},
	EpochMiningInfo: {
	  address: "0x648f1a17269627C3d465fEa40b3C229f7CacE5cA",
	  network: "CONET DePIN",
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
	SPToken: {
	  address: "Bzr4aEQEXrk7k8mbZffrQ9VzX6V3PAH4LvWKXkKppump",
	  network: "Solana Mainnet",
	},
	SpOracle: {
	  address: "0x96B2d95084C0D4b0dD67461Da06E22451389dE23",
	  abi: SpOracleAbi,
	  network: "CONET Holesky",
	},
	PurchasePassport: {
	  address: "0xE111F88A0204eE1F5DFE2cF5796F9C2179EeBBDd",
	  abi: PurchasePassportAbi,
	  network: "CONET Holesky",
	},
	SpClub: {
	  address: "0xe1949263B338D8c1eD7d4CbDE2026eb82DB78D3a",
	  abi: SpClubAbi,
	  network: "CONET DePIN",
	},
	SpReword: {
		address: '0x0e78F4f06B1F34cf5348361AA35e4Ec6460658bb',
		abi: SpReword,
		network: 'CONET DePIN'
	},
	Referrals: {
		address: '0xE235f3b481270F5DF2362c25FF5ED8Bdc834DcE9',
		abi:ReferralsV3,
		network: 'CONET DePIN'
	},
	SPClubPoint: {
		address: '0x9D27BEdb1d093F38726F60551CfefaD83fA838a2',
		abi: SpClubPoint,
		network: 'CONET DePIN'
	},
	Duplicate: {
		address: '0x87A70eD480a2b904c607Ee68e6C3f8c54D58FB08',
		network: 'CONET DePIN',
		abi: Duplicate
	},
	sGB: {
		address: '0x84aAD9aD5BbdDfC0cCcb6A599DFadaEFaF6B497E',
		network: 'CONET DePIN',
		abi: sGB
	},
	sGB_Dashboard: {
		address: '0x4b505F5Cf4926Da7375Ed7FB82f7111266908497',
		network: 'CONET DePIN',
		abi: sGB_Dashboard
	},
	SGB_Airdrop: {
		address: '0xC598e72a553a36898bAF2EeF2C444B9f07D31Ea0',
		network: 'CONET DePIN',
		abi: SGB_Airdrop
	}
  };
  
  export default contracts;
  

  // Example usage:	3298414		0x4b505F5Cf4926Da7375Ed7FB82f7111266908497	
  // 	3291544		0x866c4521797dd49d22B7566DF5D8c37E6B2b59bF		getDashboard 	getDaylyHistory
