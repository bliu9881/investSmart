import { apiRequest } from './api'

export async function importManual(holdings: any[], name: string) {
  return apiRequest('/import/manual', { method: 'POST', body: { holdings, name } })
}

export async function importCsv(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const token = ''
  const response = await fetch('/api/import/csv', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) throw new Error('CSV upload failed')
  return response.json()
}

export async function getImportTemplate(): Promise<Blob> {
  const response = await fetch('/api/import/template')
  return response.blob()
}

export async function analyzePortfolio(portfolioId: string) {
  return apiRequest(`/portfolios/${portfolioId}/analyze`, { method: 'POST' })
}

export async function getHealthReport(portfolioId: string) {
  return apiRequest(`/portfolios/${portfolioId}/health`)
}

export async function acceptRebalancing(portfolioId: string, suggestionId: string) {
  return apiRequest(`/portfolios/${portfolioId}/rebalance/accept`, {
    method: 'POST',
    body: { suggestionId },
  })
}
