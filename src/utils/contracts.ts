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
import {
	BASE_MAINNET_FACTORIES,
	BEAMIO_INDEXER_DIAMOND,
	CONET_ADDRESS_PGP,
	CONET_GB1155,
	CONET_GB_ERC20,
	CONET_GB_TOTAL,
	CONET_GUARDIAN_NODES_INFO_V6,
} from '../config/chainAddresses'

  import CoNETPGP from '@/services/ABI/conetPgp.json'
  import ActionFacetAbi from '@/services/ABI/ActionFacetAbi.json'
  const contracts = {
	GuardianNodesInfoV6: {
	  address: CONET_GUARDIAN_NODES_INFO_V6,
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
	  address: "0x28022d17064367F7246F5800af905DA3E53C01A4",
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
	/** @deprecated legacy ConetGB1155 — use GBToken (CONET_GB_ERC20) */
	sGB: {
		address: CONET_GB1155,
		network: 'CONET DePIN',
		abi: sGB
	},
	/** @deprecated legacy ConetGB_total dashboard */
	sGB_Dashboard: {
		address: CONET_GB_TOTAL,
		network: 'CONET DePIN',
		abi: sGB_Dashboard
	},
	GBToken: {
		address: CONET_GB_ERC20,
		network: 'CONET DePIN',
		abi: [
			'function balanceOf(address account) view returns (uint256)',
			'function bridgeableBalanceOf(address account) view returns (uint256)',
			'function decimals() view returns (uint8)',
		],
	},
	constPgpManager: {
		address: CONET_ADDRESS_PGP,
		network: 'CONET DePIN',
		abi: CoNETPGP
	},

	BeamioCardCCSA: {
		address: BASE_MAINNET_FACTORIES.BeamioCardCCSA_ADDRESS,
		network: 'Base',
		abi: cardAbi
  },

	BeamioAAAcountFactory: {
		address: BASE_MAINNET_FACTORIES.AA_FACTORY,
		network: 'Base' as const,
		abi: BeamioAAAcountFactoryAbi
	},

	BeamioCardFactory: {
		address: BASE_MAINNET_FACTORIES.CARD_FACTORY,
		network: 'Base',
		abi: BeamioCardFactoryAbi
	},

	BeamioDiamond: {
		address: BEAMIO_INDEXER_DIAMOND,
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
