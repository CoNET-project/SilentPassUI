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
	BeamioAAAcountFactoryAbi,
	cardAbi,
	BeamioCardFactoryAbi
  } from "./abis"


  import beamioConetABI from '@/services/ABI/beamioConetABI.json'
  import beamioConetCoreABI from '@/services/ABI/beamioConetCoreABI.json'
  import CoNETPGP from '@/services/ABI/conetPgp.json'
  import ActionFacetAbi from '@/services/ABI/ActionFacetAbi.json'
  const contracts = {
	GuardianNodesInfoV6: {
	  address: "0x2DF3302d0c9aC19BE01Ee08ce3DDA841BdcF6F03",
	  abi: GuardianNodesInfoV6Abi,
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
	beamioConet: {
		address: '0x404EEE7B7A3e31F9b8D6d6a8E76B3E601f2C4Ce1',
		network: 'CONET DePIN',
		abi: beamioConetABI
	},

	beamioCoreConet: {
		address: '0xCE8e2Cda88FfE2c99bc88D9471A3CBD08F519FEd',
		network: 'CONET DePIN',
		abi: beamioConetCoreABI
	},
	constPgpManager: {
		address: '0x84de3EA6446489E6a267B0AAD2fAe1462564C32E',
		network: 'CONET DePIN',
		abi: CoNETPGP
	},

	BeamioCardCCSA: {
		address: '0x1Dc8c473fc67358357E90636AE8607229d5e9f92',
		network: 'Base',
		abi: cardAbi
	},

	// Base Mainnet 固定地址，与 config/base-addresses.ts、deployments/BASE_MAINNET_FACTORIES.md 保持一致
	BeamioAAAcountFactory: {
		address: '0xFD48F7a6bBEb0c0C1ff756C38cA7fE7544239767',
		network: 'Base',
		abi: BeamioAAAcountFactoryAbi
	},

	BeamioCardFactory: {
		address: '0x7Ec828BAbA1c58C5021a6E7D29ccDDdB2d8D84bd',
		network: 'Base',
		abi: BeamioCardFactoryAbi
	},

	BeamioDiamond: {
		address: '0x083AE5AC063a55dBA769Ba71Cd301d5FC5896D5b',
		network: 'CONET DePIN',
		abi: {
			ActionFacet: ActionFacetAbi,
		}
	},

	BeamioGateway: {
		address: '0x3298414',
		network: 'CONET DePIN',
	
	},
  }
  
  export default contracts;
  

  // Example usage:	3298414		0x4b505F5Cf4926Da7375Ed7FB82f7111266908497	
  // 	3291544		0x866c4521797dd49d22B7566DF5D8c37E6B2b59bF		getDashboard 	getDaylyHistory
