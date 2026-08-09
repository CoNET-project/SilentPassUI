/**
 * SilentPassUI 是独立项目，发布/构建时不能跨项目相对引用 BeamioContract 根仓配置。
 * 本文件必须保持自包含，地址由 sync 脚本或手工更新。
 * 权威来源：deployments/conet-addresses.json → npx tsx scripts/updateConetReferences.ts
 */
export const BASE_MAINNET_CHAIN_ID = 8453

/** BeamioFactoryPaymasterV07 on Base. CoNET uses CONET_AA_FACTORY until the new bytecode is deployed on Base too. */
/** V1 Factory — 存量 Express Pay */
export const BEAMIO_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'
export const BEAMIO_AA_FACTORY_V1 = BEAMIO_AA_FACTORY
/** V2 — 新 AA + institutional（CoNET 已部署；见 beamio-aa-account-dev.mdc） */
export const BEAMIO_AA_FACTORY_V2 = '0xE9577cFd00A00E97D26854243B6AB4B11D5E907f'

/** @deprecated 使用 BEAMIO_AA_FACTORY */
export const BASE_AA_FACTORY = BEAMIO_AA_FACTORY
export const BASE_CARD_FACTORY = '0xF2864210577359AcaE448D2B116031a0c5EE1016'
export const BASE_CCSA_CARD_ADDRESS = '0x2032A363BB2cf331142391fC0DAd21D6504922C7'
export const BASE_TREASURY = '0x5c64a8b0935DA72d60933bBD8cD10579E1C40c58'
/** CashTrees 卡（新部署） */
export const BEAMIO_USER_CARD_ASSET_ADDRESS = '0xA756F2E27a332d6Be2d399dA543E3Ce4C8455F14'
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const CONET_MAINNET_CHAIN_ID = 224422
/** CoNET PoS HTTP RPC — 与 deployments/conet-addresses.json `rpcUrl` 同步 */
export const CONET_RPC_URL = 'https://publicrpc.conet.network'
export const CONET_BUINT = '0x54ac4672cE75EC5ACebaeF1a7aFC6F49E77Ae9Ae'
export const BEAMIO_INDEXER_DIAMOND = '0x6113fE738489c0aB64B4606Ce333aD29b44ED0C4'
/** CoNET ReferralRegistryVaultV1 ERC1967 proxy (Admin → L0 → L1/Merchant). */
export const CONET_REFERRAL_REGISTRY_VAULT_V1 = '0xD6252Cbf266B80231397Ac2a4f25ed2d9b01DEE6'
/** Vault proxy deploy block — ClaimableAccrued / claim history scan floor. */
export const CONET_REFERRAL_REGISTRY_VAULT_V1_DEPLOY_BLOCK = 431457
/** CoNET GenesisNodeReferralVaultV1 — Genesis Node Offers Admin/L0 + LockMint split. */
export const CONET_GENESIS_NODE_REFERRAL_VAULT = '0x051b65E5711E6E74bC236Fe220dcA7021841855C'
export const CONET_GENESIS_NODE_REFERRAL_VAULT_DEPLOY_BLOCK = 594820
/** Base USDC settle recipient before LockMint (must match Master settle_contractAdmin walletBase). */
export const GENESIS_NODE_BRIDGE_INITIATOR = '0x87cAeD4e51C36a2C2ece3Aaf4ddaC9693d2405E1'
/** CoNET ReferralMerchantShareModuleV1 proxy — L0 merchant→L1 rebate share config. */
export const CONET_REFERRAL_MERCHANT_SHARE_MODULE = '0xe3e06f47D89159713d67ec8530E4FE97D31Bb708'
/**
 * CoNET BUnitAirdropV2 proxy（claim / getBUnitBalance / free redeem gate）。
 * 与 deployments/conet-addresses.json `BUnitAirdrop` / `BUnitAirdropV2` 同步。
 * 免费 20 B-Unit 与 Referral 免费 redeem 码共享同一 hasClaimed，每 EOA 仅一次。
 */
export const CONET_BUNIT_AIRDROP_ADDRESS = '0x305f90A7f38289219BA1b4be98CB5b47e7b15Ac2'
/** 切到 V2 前的 BUnitAirdrop；免费领取资格须一并检查 */
export const CONET_BUNIT_AIRDROP_PREVIOUS_ADDRESS = '0xa01DFfD68b355540B840310a9f0C1E7a779C3Ce8'
/** BuintRedeemAirdrop（CoNET） */
export const CONET_BUINT_REDEEM_AIRDROP = '0x74Fc5C1f105E64663689692e3240127DdE649AF1'
/** BusinessStartKet ERC1155（CoNET） */
export const CONET_BUSINESS_START_KET = '0xAcf20dbb4DE0992d8947Ef00b505bBc17E6A03b2'
/** BusinessStartKetRedeem（CoNET） */
export const CONET_BUSINESS_START_KET_REDEEM = '0x02F98E8A2066F15F83E7758c5230398027D29f56'
/** CoNET UserCard Factory（224422） */
export const CONET_CARD_FACTORY = '0xfA52a0CcC96C19cF4b6Ea864615F6d52BD0774FB'
/** CoNET EntryPoint-aware BeamioFactoryPaymasterV07（224422） */
export const CONET_AA_FACTORY = '0x869B31C87ABd9bFB858F5183Ef6021b28ED225E2'
/** CoNET Institutional V2 Factory */
export const CONET_AA_FACTORY_V2 = '0xE9577cFd00A00E97D26854243B6AB4B11D5E907f'
/** CoNET 默认 BeamioUserCard（AA Factory `beamioUserCard`） */
export const CONET_BEAMIO_USER_CARD_DEFAULT = '0xA5C727d11d04BeBC095bd814c6530c4e77fD6662'
/** CoNET 唯一 canonical USDC（Treasury V3 `TreasuryCanonicalERC20V3`） */
export const CONET_USDC = '0x5209865D404aA5646eDe5B91CD4218909eA72eDA'
/** CoNET 业务国库 = TreasuryBridgeV3（唯一 conet-USDC 增发 / fee mint / 桥） */
export const CONET_TREASURY = '0xa208982212978550594A7FEEB70a61665d129003'
/** TreasuryBridgeV3 proxy — 与 {@link CONET_TREASURY} 同址 */
export const CONET_TREASURY_BRIDGE_V3 = CONET_TREASURY
/**
 * @deprecated 旧工厂 ConetTreasury CREATE2（Base Circle USDC settle 仍可能用同址）。
 * CoNET 业务路径勿再用此址 mint。
 */
export const CONET_TREASURY_CREATE2 = '0xa311c8fBE7CafC611603Ee925465A62493B73B30'
/** @deprecated 工厂版 USDC；停增发，仅存量 */
export const CONET_USDC_FACTORY_LEGACY = '0xfD0D7B0706AaB5E4351bcED37bC3C77ed6813907'
/**
 * CoNET canonical GB — `GBToken` ERC20（9 decimals；free/paid 双池）。
 * 全项目「GB」默认指此地址；见 `.cursor/rules/beamio-gb-erc20-canonical.mdc`。
 */
export const CONET_GB_ERC20 = '0xC3EF02DaE632b4C10abB66e07d92a387c10838D8'
/** @alias CONET_GB_ERC20 */
export const CONET_GB = CONET_GB_ERC20
export const CONET_GB_DECIMALS = 9
/** @deprecated minter=旧国库 0x6dC6… */
export const CONET_USDC_LEGACY_UUPS_V1 = '0x84e55A7d82aEa1243cB88b20dDde9Ba5cea0E134'
/** @deprecated legacy FactoryERC20 (non-UUPS) */
export const CONET_USDC_LEGACY = '0x2975c85D8Cc8F5d263492E332A6dAa7ad11aDBdC'
export const CONET_BEAMIO_USER_CARD_FORMATTING_LIB = '0x9727136BC5DAA5540e7397C9086e9980EBDD0e48'
export const CONET_BEAMIO_USER_CARD_TRANSFER_LIB = '0xBcf3f8C5994B02B89fB743e1dee6AFDD5a49a664'
/** BeamioOracle on CoNET mainnet */
export const BEAMIO_ORACLE_CONET = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
/** CoNET 224422 — GuardianNodesInfoV6 */
export const CONET_GUARDIAN_NODES_INFO_V6 = '0xBC6b53065b5647261396d002bDBA0d3396E0722f'
/** CoNET AddressPGP（Chat 路由公钥） */
export const CONET_ADDRESS_PGP = '0x684b0ac760cEE9c9b85de36d69746420648Cf9e2'
/**
 * CoNET 224422 — ChatIndexRegistry (UUPS proxy). On-chain head pointer to the encrypted
 * chat-history index (IPFS content hash). Read via RPC `getPointer(eoa)`; write via
 * EOA off-chain EIP-712 signature relayed gaslessly through beamio.app/api. Enables
 * fresh-device recovery of chat history after account delete/restore.
 */
export const CONET_CHAT_INDEX_REGISTRY = '0x1511Caa71081C84d8a591490D1b83879088EED72'
/** @internal ChatIndexRegistry implementation behind {@link CONET_CHAT_INDEX_REGISTRY}. */
export const CONET_CHAT_INDEX_REGISTRY_IMPL = '0xF94299760E07E62eC33A8e91fA585f0b40d137Ee'
/** CoNET AccountRegistry（Beamio 社交账户） */
export const CONET_ACCOUNT_REGISTRY = '0xfFDc8d2021A41F4638Cb3eCf58B5155383EE9f6d'
/** @deprecated ConetGB1155 挖矿记账轨已弃用；勿在新 UI/API 当作用户 GB 余额来源 */
export const CONET_GB1155 = '0x3Dc53e528d45225e8F38c391Cc6a72CDec435748'
/** @deprecated ConetGB_total（1155 全网聚合）已弃用 */
export const CONET_GB_TOTAL = '0x949ed49faB0e999f685f16e09Cf5EaaF4090F290'
/** ValidatorDepositRedeem（CoNET 224422）— resolveNodeBundle / resolveUnifiedIncomeStats RPC 直读 */
export const CONET_VALIDATOR_DEPOSIT_REDEEM = '0xc71e246DD78B37C2fABc905D340932F28F503433'
/**
 * GBDepinAirdrop — DePIN 节点收费 GB（mintPaid → 受益人钱包）。
 * 部署后由 sync / deployments/conet-GBDepinAirdrop.json 填入；未部署时空字符串（UI 仅展示 legacy routing GB）。
 */
export const CONET_GB_DEPIN_AIRDROP = '0x62bcc59cC36C737E8AfBb0914F840d12cd33025f'
/** @deprecated ConetGB1155 token id=0；legacy 18-decimal 挖矿口径 */
export const CONET_GB_TOTAL_TOKEN_ID = 0

export const BASE_MAINNET_FACTORIES = {
  AA_FACTORY: BEAMIO_AA_FACTORY,
  CARD_FACTORY: BASE_CARD_FACTORY,
  BeamioCardCCSA_ADDRESS: BASE_CCSA_CARD_ADDRESS,
} as const

export const CONTRACT_ADDRESSES = {
  base: {
    chainId: BASE_MAINNET_CHAIN_ID,
    aaFactory: BEAMIO_AA_FACTORY,
    cardFactory: BASE_CARD_FACTORY,
    ccsaCard: BASE_CCSA_CARD_ADDRESS,
    baseTreasury: BASE_TREASURY,
    usdc: USDC_BASE,
  },
  conet: {
    chainId: CONET_MAINNET_CHAIN_ID,
    aaFactory: CONET_AA_FACTORY,
    buint: CONET_BUINT,
    bUnitAirdrop: CONET_BUNIT_AIRDROP_ADDRESS,
    beamioIndexerDiamond: BEAMIO_INDEXER_DIAMOND,
    buintRedeemAirdrop: CONET_BUINT_REDEEM_AIRDROP,
    businessStartKet: CONET_BUSINESS_START_KET,
    businessStartKetRedeem: CONET_BUSINESS_START_KET_REDEEM,
    cardFactory: CONET_CARD_FACTORY,
    defaultUserCard: CONET_BEAMIO_USER_CARD_DEFAULT,
    usdc: CONET_USDC,
    conetTreasury: CONET_TREASURY,
    treasuryBridgeV3: CONET_TREASURY_BRIDGE_V3,
    beamioOracle: BEAMIO_ORACLE_CONET,
    guardianNodesInfoV6: CONET_GUARDIAN_NODES_INFO_V6,
    addressPgp: CONET_ADDRESS_PGP,
    accountRegistry: CONET_ACCOUNT_REGISTRY,
    gbErc20: CONET_GB_ERC20,
    gbDepinAirdrop: CONET_GB_DEPIN_AIRDROP,
    /** @deprecated legacy ConetGB1155 */
    conetGb1155: CONET_GB1155,
    /** @deprecated legacy ConetGB_total */
    conetGbTotal: CONET_GB_TOTAL,
  },
} as const
