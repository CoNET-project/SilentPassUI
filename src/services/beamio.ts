export type IBalance= {
	usdc: string
	eth: string
	oracle: {
		bnb: string
		eth: string
		usdc: string
	}
}


export const getBalance = async (address: string) => {
	if (!address) return null

	const url = `https://api.settleonbase.xyz/api/getBalance?address=${encodeURIComponent(address)}`

	try {
		const response = await fetch(url)
		if (!response.ok) {
			console.error(`getBalance error: HTTP ${response.status}`)
			return null
		}

		const data = await response.json()

		const ret: IBalance = data.balance
		return ret

	} catch (err) {
		console.error('getBalance fetch error:', err)
		return null
	}
}
