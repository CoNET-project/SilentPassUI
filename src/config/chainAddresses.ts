/**
 * Base 主网合约地址（与项目根 config/base-addresses.ts 保持一致）。
 * 重部署 AA/Card Factory 后运行 npm run redeploy:card-factory:base 会同步更新根 config 与本文件。
 */
export const BASE_MAINNET_CHAIN_ID = 8453

export const BASE_MAINNET_FACTORIES = {
  /** AA 账户工厂 (BeamioFactoryPaymasterV07) */
  AA_FACTORY: '0xD86403DD1755F7add19540489Ea10cdE876Cc1CE',
  /** UserCard 工厂 (BeamioUserCardFactoryPaymasterV07) */
  CARD_FACTORY: '0x19C000c00e6A2b254b39d16797930431E310BEdd',
  /** CCSA 卡 (BeamioUserCard 实例)。与 x402sdk chainAddresses.ts BASE_CCSA_CARD_ADDRESS 必须一致；重发卡后运行 replace-ccsa-address.js 同步两处 */
  BeamioCardCCSA_ADDRESS: '0xA1A9f6f942dc0ED9Aa7eF5df7337bd878c2e157b',
  /** 旧 CCSA 卡地址（用于 redeem 详情 fallback：新卡查不到时尝试旧卡） */
  OLD_CCSA_CARD_ADDRESS: '0x6870acA2f4f6aBed6B10B0C8D76C75343398fd64',
} as const
