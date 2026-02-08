/**
 * Base 主网合约地址（与项目根 config/base-addresses.ts 保持一致）。
 * 重部署 AA Factory 后运行 npm run redeploy:aa-factory:base 会同步更新根 config 与本文件。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

export const BASE_MAINNET_FACTORIES = {
  /** AA 账户工厂 (BeamioFactoryPaymasterV07) */
  AA_FACTORY: '0xD4759c85684e47A02223152b85C25D2E5cD2E738',
  /** UserCard 工厂 (BeamioUserCardFactoryPaymasterV07) */
  CARD_FACTORY: '0x73e3b722Eb55C92Fe73DEC01c064a5C677079E03',
  /** CCSA 卡 (BeamioUserCard 实例)。与 x402sdk chainAddresses.ts BASE_CCSA_CARD_ADDRESS 必须一致；重发卡后运行 replace-ccsa-address.js 同步两处 */
  BeamioCardCCSA_ADDRESS: '0xd81B78B3E3253b37B44b75E88b6965FE887721a3',
} as const
