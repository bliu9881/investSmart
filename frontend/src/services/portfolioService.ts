import { apiRequest } from './api'
import type { Portfolio, Recommendation } from '@/stores/portfolioStore'

export async function generatePortfolio(): Promise<Portfolio> {
  return apiRequest<Portfolio>('/portfolios/generate', { method: 'POST' })
}

export async function getPortfolios(): Promise<Portfolio[]> {
  const result = await apiRequest<{ portfolios: Portfolio[] }>('/portfolios')
  return result.portfolios
}

export async function getPortfolio(id: string): Promise<Portfolio> {
  const result = await apiRequest<{ portfolio: Portfolio }>(`/portfolios/${id}`)
  return result.portfolio
}

export async function savePortfolio(portfolio: Partial<Portfolio>): Promise<Portfolio> {
  const result = await apiRequest<{ portfolio: Portfolio }>('/portfolios', {
    method: 'POST',
    body: portfolio,
  })
  return result.portfolio
}

export async function deletePortfolio(id: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/portfolios/${id}`, { method: 'DELETE' })
}

export async function redistributeAllocations(
  portfolioId: string,
  removedTicker: string
): Promise<Recommendation[]> {
  return apiRequest<Recommendation[]>(
    `/portfolios/${portfolioId}/redistribute`,
    { method: 'POST', body: { removedTicker } }
  )
}
