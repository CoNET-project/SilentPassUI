/**
 * BeamioOracle rates on Base — Worker-portable (no beamio.ts).
 */

import { ethers } from 'ethers'

const BEAMIO_ORACLE_BASE = '0x77CB8358c5a37aB7190b0A2C7EaA7fEeDCF11008'
const BASE_RPC = 'https://base-rpc.conet.network'
const ABI = ['function getRate(uint8 c) view returns (uint256)'] as const

/** BeamioCurrency enum — CAD=0 … TWD=8 */
const BEAMIO_CURRENCY = {
	CAD: 0,
	JPY: 2,
	CNY: 3,
	USDC: 4,
	HKD: 5,
	EUR: 6,
	SGD: 7,
	TWD: 8,
} as const

export type WorkerOracleRates = {
	usdcad?: string
	usdjpy?: string
	usdcny?: string
	usdc?: string
	usdhkd?: string
	usdtwd?: string
	usdeur?: string
	usdsgd?: string
}

export type WorkerCurrencyData = {
	CAD: number
	USD: number
	JPY: number
	CNY: number
	USDC: number
	HKD: number
	SGD: number
	EUR: number
	TWD: number
}

export function parseWorkerOracleToCurrencyData(data: WorkerOracleRates | null): WorkerCurrencyData {
	if (!data) {
		return { CAD: 1.35, USD: 1, JPY: 150, CNY: 7.2, USDC: 1, HKD: 7.8, SGD: 1.35, EUR: 0.92, TWD: 31 }
	}
	return {
		CAD: Number(data.usdcad) || 1.35,
		USD: 1,
		JPY: Number(data.usdjpy) || 150,
		CNY: Number(data.usdcny) || 7.2,
		USDC: Number(data.usdc) || 1,
		HKD: Number(data.usdhkd) || 7.8,
		TWD: Number(data.usdtwd) || 31,
		EUR: Number(data.usdeur) || 0.92,
		SGD: Number(data.usdsgd) || 1.35,
	}
}

export async function fetchWorkerOracleRates(): Promise<
	{ ok: true; rates: WorkerOracleRates; currencyData: WorkerCurrencyData } | { ok: false }
> {
	try {
		const provider = new ethers.JsonRpcProvider(BASE_RPC, 8453, {
			staticNetwork: true,
			batchMaxCount: 1,
		})
		const oracle = new ethers.Contract(BEAMIO_ORACLE_BASE, ABI, provider)
		const ids = [
			BEAMIO_CURRENCY.CAD,
			BEAMIO_CURRENCY.JPY,
			BEAMIO_CURRENCY.CNY,
			BEAMIO_CURRENCY.USDC,
			BEAMIO_CURRENCY.HKD,
			BEAMIO_CURRENCY.EUR,
			BEAMIO_CURRENCY.SGD,
			BEAMIO_CURRENCY.TWD,
		] as const
		const rates = await Promise.all(ids.map((c) => oracle.getRate(c) as Promise<bigint>))
		const ratesNum = rates.map((r) => Number(ethers.formatUnits(r, 18)))
		const raw: WorkerOracleRates = {
			usdcad: ratesNum[0] > 0 ? String(1 / ratesNum[0]) : undefined,
			usdjpy: ratesNum[1] > 0 ? String(1 / ratesNum[1]) : undefined,
			usdcny: ratesNum[2] > 0 ? String(1 / ratesNum[2]) : undefined,
			usdc: String(ratesNum[3] || 1),
			usdhkd: ratesNum[4] > 0 ? String(1 / ratesNum[4]) : undefined,
			usdeur: ratesNum[5] > 0 ? String(1 / ratesNum[5]) : undefined,
			usdsgd: ratesNum[6] > 0 ? String(1 / ratesNum[6]) : undefined,
			usdtwd: ratesNum[7] > 0 ? String(1 / ratesNum[7]) : undefined,
		}
		return { ok: true, rates: raw, currencyData: parseWorkerOracleToCurrencyData(raw) }
	} catch {
		return { ok: false }
	}
}
