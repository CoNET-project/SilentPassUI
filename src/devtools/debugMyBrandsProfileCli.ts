/**
 * 与 App 一致：getCardsOfOwnerWithDetailsForProfile（含 latestCards 持卡扫描）
 * npx tsx src/devtools/debugMyBrandsProfileCli.ts 0x...
 */
import { getCardsOfOwnerWithDetailsForProfile } from '@/services/BeamioCard'

const eoa = (process.argv[2] || '0x15d94398cABEA4cbcD424f69272FC95a5ab907D7').trim()
const aa = (process.argv[3] || '').trim()

const t0 = Date.now()
getCardsOfOwnerWithDetailsForProfile({ keyID: eoa, aaAccount: aa || undefined })
	.then((r) => {
		console.log(
			JSON.stringify(
				{
					ms: Date.now() - t0,
					trusted: r.trusted,
					count: r.cards.length,
					cards: r.cards,
				},
				null,
				2
			)
		)
	})
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
