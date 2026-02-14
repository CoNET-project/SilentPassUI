/**
 * Base 主网合约地址（与项目根 config/base-addresses.ts 保持一致）。
 * 重部署 AA/Card Factory 后运行 npm run redeploy:card-factory:base 会同步更新根 config 与本文件。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

export const BASE_MAINNET_FACTORIES = {
  /** AA 账户工厂 (BeamioFactoryPaymasterV07) */
  AA_FACTORY: '0xD86403DD1755F7add19540489Ea10cdE876Cc1CE',
  /** UserCard 工厂 (BeamioUserCardFactoryPaymasterV07) */
  CARD_FACTORY: '0xbDC8a165820bB8FA23f5d953632409F73E804eE5',
  /** CCSA 卡 (BeamioUserCard 实例)。与 x402sdk chainAddresses.ts BASE_CCSA_CARD_ADDRESS 必须一致；重发卡后运行 replace-ccsa-address.js 同步两处 */
  BeamioCardCCSA_ADDRESS: '0xb6ba88045F854B713562fb7f1332D186df3B25A8',
} as const
