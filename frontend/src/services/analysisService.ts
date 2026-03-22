import { apiRequest } from './api'

export async function getStockAnalysis(ticker: string) {
  return apiRequest(`/stocks/${ticker}/analysis`)
}

export async function getAnalysisDimension(ticker: string, type: string) {
  return apiRequest(`/stocks/${ticker}/analysis/${type}`)
}

export async function retryAnalysis(ticker: string, type: string) {
  return apiRequest(`/stocks/${ticker}/analysis/${type}/retry`, { method: 'POST' })
}

export async function compareStocks(tickers: string[]) {
  return apiRequest('/compare', { method: 'POST', body: { tickers } })
}

export async function validateTickers(tickers: string[]) {
  return apiRequest('/validate-tickers', { method: 'POST', body: { tickers } })
}
