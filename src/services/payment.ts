import { beamioConet } from "@/utils/constants"
import {ethers} from 'ethers'
import {fiatPrefix, formatAmount, formatTimev2, calcFeeFromReceived, calcFeeFromNumber} from '@/services/currency'
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt, searchUsername, } from '@/services/beamio'

export const getActiveArray = async (profile: profile): Promise<TransferHistork[]> => {
		
		let address = profile.keyID
	

		const myAddrLocal = address.toLowerCase()

		let mapped: TransferHistork[], mappedLing: TransferHistork[], mappedCheck: TransferHistork[]
		try {
			
			const [_transfer, _links, _checks] = await Promise.all([
				beamioConet.getTransferHistory(address, 0, 100),
				beamioConet.getLinksHistory(address, 0, 100),
				beamioConet.getCheckHistory(address, 0, 100)
			])
			
			const transfer: Transfer[] = _transfer[1]
			
			mapped = transfer.map(n => {
				let requestDetail: IRequestCurrencyDetail|undefined = undefined
				const amount = Number(ethers.formatUnits(n.amount, 6))
				let card: IImageCard|null = null
				let payme: payMe|null = null
				const nodeEX = n?.note?.split('\r\n')

				//		try get currency data
				let paymeData = nodeEX.length -1

				try {
					if (paymeData > -1) {
						payme = JSON.parse(nodeEX[paymeData--])
					}
					
					
				} catch (ex) {
					paymeData ++
				}

				//		try get card data
				try {
					if (paymeData > -1) {
						const cardData = JSON.parse(nodeEX[paymeData --])
						card = cardData?.card || cardData
					}
					
				} catch (ex) {
					paymeData ++
				}

				
				const _amount = Number(payme?.currencyAmount)

				if( payme?.currency && fiatPrefix(payme.currency) && !isNaN(_amount) && _amount > 0) {
					const currencyRate = Number(payme.currencyAmount)/amount 
					requestDetail = {
						requestCurrency: payme.currency,
						totalPayCurrency: Number(payme.currencyAmount),
						totalPayUSDC: amount,
						feeCurrency: 0,
						feeUSDC: 0,
						receivedCurrency: Number(payme.currencyAmount),
						receivedUSDC: amount,
						currencyTip: 0,
						USDCTip: 0,
						rate: currencyRate,
						title: payme?.title,
						textNote: paymeData > -1 ? nodeEX[paymeData] : ''
					}
				}

				const ret: TransferHistork = {
					date: Number(n.timestamp * BigInt(1000)),
					amount: Number(ethers.formatUnits(n.amount, 6)),
					address: n.from.toLowerCase() === myAddrLocal ? n.to.toLowerCase() : n.from.toLowerCase(),
					hash: n.finisedHash,
					requestCurrency: payme?.currency||'USDC',
					note: n.note,
					type: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					mode: 'pay',
					fee: 0,
					type1: myAddrLocal === n.to.toLowerCase() ? 'received' : 'sent',
					preAmount: Number(ethers.formatUnits(n.amount, 6)),
					requestDetail
				}
				if (card?.image) {
					ret.card = card
				}

				return ret
			})
			
			const links: LinksHistory[] = _links[1]
			mappedLing = links.map(n => {
				const isRequest = n.from.toLowerCase() === myAddrLocal
				
				const isPending = isRequest ? n.to === ethers.ZeroAddress : n.from === ethers.ZeroAddress
				
				const isReject = isRequest ?  n.to === '0x1000000000000000000000000000000000000000' : n.from === '0x1000000000000000000000000000000000000000'
				const account = (isPending||isReject) ? '' : isRequest ? n.to : n.from
				
				const payAmount = Number(ethers.formatUnits(n.payAmount, 6))
				const _amount =  Number(ethers.formatUnits(n.amount, 6))

				const _requestCurrencyData = n?.node?.split('\r\n')

				const ooo = _requestCurrencyData[_requestCurrencyData.length - 1]
				let requestCurrency: ICurrency = 'USDC'
				let kkk: payMe|null
				let group: paymentType = 'onetime'
				let requestDetail: IRequestCurrencyDetail|undefined = undefined
				let type: HistoryFilter = isPending ? 'pending' : isRequest ? 'sent' : 'received'
				
				
				try {
					kkk = JSON.parse(ooo)
						if (kkk) {
							requestCurrency = kkk.currency
							if (typeof kkk?.oneTimeMode === 'undefined') {
								group = 'payme'
							} else {
								group = kkk.oneTimeMode ? 'onetime' : 'reusable'
							}
							
						}
						
					
						let totalPayUSDC = payAmount
						
						
							//		totalPayUSDC: totalPayCurrency = 1:x
						
							//		isRequest : calcFeeFromNumber(totalPayUSDC)
							//		!isRequest :  totalPayUSDC + fee = realRequestAmount, fee = calcFeeFromNumber(realRequestAmount); realRequestAmount = 
						
						
						//		n.amount 在request 时是 currency request，n.payAmount 是实际支付的USDC （没有扣除手续费）
						//		payMe时 n.payAmount === n.amount

						if (totalPayUSDC) {
							const feeUSDC = calcFeeFromReceived(totalPayUSDC)
							const requestCurrencyAmount = Number(kkk?.currencyAmount||0)
							const currencyTip = Number(kkk?.currencyTip||0)
							const taxCurrency = Number(kkk?.currencyTax||0)
							const currencyRate = (requestCurrencyAmount + currencyTip + taxCurrency )/totalPayUSDC
							const requestUSDAmount = currencyRate > 0 ? requestCurrencyAmount / currencyRate : 0

							const totalPayCurrency = totalPayUSDC * currencyRate
							
							const feeCurrency = feeUSDC * currencyRate
							
							const USDCTip = currencyRate ? currencyTip/currencyRate : 0
							const receivedUSDC = totalPayUSDC - feeUSDC
							const receivedCurrency = receivedUSDC * currencyRate
							const code = kkk?.code
							const taxUSDC = currencyRate ? taxCurrency/currencyRate : 0
							const title = kkk?.title
							const textNote = _requestCurrencyData.length - 2 > -1 ? _requestCurrencyData[_requestCurrencyData.length - 2] : ''

							requestDetail = {
								
								requestCurrency,
								totalPayUSDC,
								totalPayCurrency,

								requestCurrencyAmount,
								requestUSDAmount,

								

								feeUSDC,
								feeCurrency,

								currencyTip,
								USDCTip,

								taxUSDC,
								taxCurrency,

								receivedUSDC,
								receivedCurrency,
								
								rate: currencyRate,
								code,
								title,
								textNote
								
							}
							
						}
					
				} catch (ex) {
					requestCurrency = ooo as ICurrency
				}
				
				
				const ret: TransferHistork = {
					date: Number(n.issueTimestamp * BigInt(1000)),
					amount: payAmount - (requestDetail?.feeUSDC||0),
					address: account,
					hash: (n.successAuthorizationHash.startsWith('0x00') ? n.payHash : n.successAuthorizationHash),
					note: n.node,
					type,
					mode: 'request',
					fee: 0,
					type1: type === 'sent' ? 'paid' : type ==='pending' ? '' :'received',
					preAmount: payAmount,
					requestCurrency,
					requestDetail,
					group
				}
				
				return ret
			})

			
			//	过滤PayME
			mappedLing = mappedLing.filter (n => !!n?.requestDetail)
			const memoSelfDeposited: Map<string, boolean> = new Map()
			const checks: CheckHistory[] = _checks[1]
			mappedCheck = await Promise.all(
				checks.map(async (n): Promise<TransferHistork> => {
					const text = n.node.split('\r\n');
					const encryptedText = text[1];
					let cleanText = ''
					try {
						cleanText =
						encryptedText && (await aesGcmDecrypt(encryptedText, profile.privateKeyArmor));
					} catch (ex) {
						console.log (`${encryptedText} aesGcmDecrypt Error!`)
					}
					
					let ce: { secureCode: string; passcode: string } | undefined;
					if (cleanText) {
						ce = JSON.parse(cleanText);
					}
					const isSend = n.from.toLowerCase() === myAddrLocal
					const account = isSend ? n.to === ethers.ZeroAddress ? '' : n.to : n.from === ethers.ZeroAddress ? '' : n.from
					const type: HistoryFilter = !account ? 'pending' : isSend ? 'completed' : 'deposited'
					const preAmount = Number(ethers.formatUnits(n.amount, 6))
					const fee = calcFeeFromNumber(preAmount)
					let amount = preAmount
					//		self cashcode
					let hash = n.successAuthorizationHash
					
					let type1: HistoryFilter|'' = type === 'deposited' ? 'received' : 'sent'

					if (account.toLowerCase() === myAddrLocal) {
						const isMemo = memoSelfDeposited.get(n.depositHash)
						//		first ?
						if (!isMemo) {
							memoSelfDeposited.set(n.depositHash, true)
							type1 = 'sent'
							
						} else {
							type1 = 'received'
							hash = n.depositHash
							amount = preAmount - fee
						}
					} else {
						if (type1 === 'received') {
							amount = amount - fee
							hash = n.depositHash
						}
					}


					let card: IImageCard|null = null
					const nodeEX = n?.node?.split('\r\n')
					try {
						if (nodeEX[nodeEX.length - 1]) {
							const _card = JSON.parse(nodeEX[nodeEX.length - 1])
							if (_card?.card) {
								card = _card.card
							}
						}
					} catch (ex) {

					}
					const ret: TransferHistork = {
						date: Number(n.createTimestamp * BigInt(1000)),
						amount,
						address: account.toLowerCase(),
						hash,
						note: n.node,
						type,
						security: ce?.secureCode,
						passcode: ce?.passcode,
						redeemHash: n.payHash,
						mode: 'cashcode',
						fee,
						type1,
						preAmount
					}

					if (card?.currency) {
						ret.card = card
					}
					
					return ret
				})
			)
			


			// 1️⃣ 先合并，再按 date 做倒序排序（新 -> 旧）
			const alldatas: TransferHistork[] = [...mapped, ...mappedLing, ...mappedCheck].sort(
				(a, b) => b.date - a.date
			)

			const latest5 = alldatas.slice(0, 5)
			
			return latest5


		} catch (ex: any) {
			console.log(ex.message)
		}

		return []
	}