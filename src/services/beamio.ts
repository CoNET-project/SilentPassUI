export async function getBalance(address: string): Promise<any> {
	if (!address) return null

	const url = `https://api.settleonbase.xyz/api/getBalance?address=${encodeURIComponent(address)}`

	try {
		const response = await fetch(url)
		if (!response.ok) {
			console.error(`getBalance error: HTTP ${response.status}`)
			return null
		}

		const data = await response.json()
		return data

	} catch (err) {
		console.error('getBalance fetch error:', err)
		return null
	}
}