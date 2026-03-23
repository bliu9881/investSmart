import { apiRequest } from './api'

export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  direction: 'up' | 'down' | 'flat'
}

export interface MarketMover {
  ticker: string
  name: string
  price: number
  change: number
  changePct: number
  direction: 'up' | 'down'
}

export interface MarketData {
  indices: MarketIndex[]
  gainers: MarketMover[]
  losers: MarketMover[]
  timestamp: number
}

export async function getMarketOverview(): Promise<MarketData | null> {
  try {
    return await apiRequest<MarketData>('/market')
  } catch {
    return null
  }
}

export interface StockPrice {
  price: number
  prevClose: number
  change: number
  changePct: number
  name: string
  sector: string
}

export async function getStockPrices(tickers: string[]): Promise<Record<string, StockPrice>> {
  if (tickers.length === 0) return {}
  try {
    const data = await apiRequest<{ prices: Record<string, StockPrice> }>(`/market?tickers=${tickers.join(',')}`)
    return data.prices ?? {}
  } catch {
    return {}
  }
}
