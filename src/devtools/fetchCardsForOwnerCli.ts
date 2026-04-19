/**
 * 一次性 CLI：pnpm exec tsx src/devtools/fetchCardsForOwnerCli.ts 0x...
 * 用于排查某 EOA 在 factory.cardsOfOwner 下的会员卡数量与地址。
 */
import { getCardsOfOwnerWithDetails } from '@/services/BeamioCard'

const addr =
	(process.argv[2] || '0x7DccD594CA4681104524BF0450c547c8Bd2fEae1').trim()

getCardsOfOwnerWithDetails(addr)
	.then((cards) => {
		console.log(JSON.stringify({ owner: addr, count: cards.length, cards }, null, 2))
	})
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
