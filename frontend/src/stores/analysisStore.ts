import { create } from 'zustand'

export interface SentimentAnalysis {
  score: number // -100 to +100
  topFactors: { factor: string; source: string; impact: string }[]
  dataSufficient: boolean
}

export interface FundamentalAnalysis {
  pe: number | null
  pb: number | null
  debtToEquity: number | null
  roe: number | null
  fcfYield: number | null
  sectorMedians: Record<string, number>
  healthRating: 'Strong' | 'Moderate' | 'Weak'
  summary: string
  isStale: boolean
}

export interface TechnicalAnalysis {
  sma50: number | null
  sma200: number | null
  rsi: number | null
  macd: { macd: number; signal: number; histogram: number } | null
  bollingerBands: { upper: number; middle: number; lower: number } | null
  indicators: { name: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }[]
}

export interface NewsAnalysis {
  articles: {
    title: string
    source: string
    publishedAt: string
    impactRating: 'High' | 'Medium' | 'Low'
    impactDirection: 'Positive' | 'Negative' | 'Neutral'
  }[]
}

export interface AnalystAnalysis {
  consensus: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  avgPriceTarget: number
  priceTargetLow: number
  priceTargetHigh: number
  analystCount: number
  limitedCoverage: boolean
}

export interface CompositeScore {
  score: number // 0-100
  color: 'green' | 'yellow' | 'red'
  breakdown: {
    sentiment: number | null
    fundamental: number | null
    technical: number | null
    news: number | null
    analyst: number | null
  }
  missingDimensions: string[]
}

export interface StockAnalysis {
  ticker: string
  sentiment?: SentimentAnalysis
  fundamental?: FundamentalAnalysis
  technical?: TechnicalAnalysis
  news?: NewsAnalysis
  analyst?: AnalystAnalysis
  composite?: CompositeScore
  loading: Record<string, boolean>
  errors: Record<string, string>
}

interface AnalysisState {
  analyses: Record<string, StockAnalysis>
  getAnalysis: (ticker: string) => StockAnalysis | undefined
  setAnalysis: (ticker: string, analysis: Partial<StockAnalysis>) => void
  setLoading: (ticker: string, dimension: string, loading: boolean) => void
  setError: (ticker: string, dimension: string, error: string) => void
  clearAnalysis: (ticker: string) => void
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analyses: {},
  getAnalysis: (ticker) => get().analyses[ticker],
  setAnalysis: (ticker, analysis) =>
    set((state) => ({
      analyses: {
        ...state.analyses,
        [ticker]: { ...state.analyses[ticker], ...analysis, ticker } as StockAnalysis,
      },
    })),
  setLoading: (ticker, dimension, loading) =>
    set((state) => {
      const existing = state.analyses[ticker] || { ticker, loading: {}, errors: {} }
      return {
        analyses: {
          ...state.analyses,
          [ticker]: {
            ...existing,
            loading: { ...existing.loading, [dimension]: loading },
          } as StockAnalysis,
        },
      }
    }),
  setError: (ticker, dimension, error) =>
    set((state) => {
      const existing = state.analyses[ticker] || { ticker, loading: {}, errors: {} }
      return {
        analyses: {
          ...state.analyses,
          [ticker]: {
            ...existing,
            errors: { ...existing.errors, [dimension]: error },
          } as StockAnalysis,
        },
      }
    }),
  clearAnalysis: (ticker) =>
    set((state) => {
      const { [ticker]: _, ...rest } = state.analyses
      return { analyses: rest }
    }),
}))
