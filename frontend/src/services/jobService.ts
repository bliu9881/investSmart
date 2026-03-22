import { apiRequest } from './api'

interface GenerateResponse {
  jobId: string
  status: string
}

interface JobStatus {
  jobId: string
  status: string
  portfolioId?: string
  error?: string
  createdAt?: number
}

export async function startPortfolioGeneration(preferences: {
  riskTolerance: string
  investmentHorizon: string
  preferredSectors: string[]
  favoriteStocks: string[]
}): Promise<GenerateResponse> {
  return apiRequest<GenerateResponse>('/portfolios/generate', {
    method: 'POST',
    body: { preferences },
  })
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiRequest<JobStatus>(`/jobs/${jobId}`)
}

export function pollJobStatus(
  jobId: string,
  onUpdate: (status: JobStatus) => void,
  intervalMs: number = 5000
): () => void {
  let stopped = false

  const poll = async () => {
    while (!stopped) {
      try {
        const status = await getJobStatus(jobId)
        await onUpdate(status)

        if (status.status === 'completed' || status.status === 'failed') {
          return
        }
      } catch (err) {
        console.warn('Poll failed, retrying...', err)
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  poll()

  // Return cancel function
  return () => {
    stopped = true
  }
}

export async function startHealthAnalysis(portfolioId: string): Promise<{ jobId: string; status: string }> {
  return apiRequest<{ jobId: string; status: string }>('/portfolios/analyze', {
    method: 'POST',
    body: { portfolioId },
  })
}

export async function getHealthReport(portfolioId: string): Promise<any | null> {
  try {
    const result = await apiRequest<{ report: any }>(`/portfolios/${portfolioId}/health`)
    return result.report
  } catch (err) {
    // 404 = no report yet, not an error
    if (err instanceof Error && err.message.includes('404')) return null
    throw err
  }
}

export async function acceptRebalancing(portfolioId: string, suggestionId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/portfolios/${portfolioId}/rebalance/accept`, {
    method: 'POST',
    body: { suggestionId },
  })
}
