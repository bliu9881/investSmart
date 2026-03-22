import { useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAnalysisStore,
  type SentimentAnalysis,
  type FundamentalAnalysis,
  type TechnicalAnalysis,
  type NewsAnalysis,
  type AnalystAnalysis,
  type CompositeScore,
} from '@/stores/analysisStore'
import { SentimentCard } from '@/components/analysis/SentimentCard'
import { FundamentalCard } from '@/components/analysis/FundamentalCard'
import { TechnicalCard } from '@/components/analysis/TechnicalCard'
import { NewsCard } from '@/components/analysis/NewsCard'
import { AnalystCard } from '@/components/analysis/AnalystCard'
import { CompositeScoreBadge } from '@/components/analysis/CompositeScoreBadge'

// TODO: Replace with real data from API
const MOCK_STOCK_INFO: Record<string, { name: string; price: number; change: number; changePercent: number }> = {
  AAPL: { name: 'Apple Inc.', price: 178.72, change: 2.34, changePercent: 1.33 },
  MSFT: { name: 'Microsoft Corporation', price: 417.88, change: -1.56, changePercent: -0.37 },
  GOOGL: { name: 'Alphabet Inc.', price: 174.13, change: 3.21, changePercent: 1.88 },
  TSLA: { name: 'Tesla, Inc.', price: 248.42, change: -5.18, changePercent: -2.04 },
  NVDA: { name: 'NVIDIA Corporation', price: 875.28, change: 12.45, changePercent: 1.44 },
}

// TODO: Replace with real API calls
const MOCK_SENTIMENT: SentimentAnalysis = {
  score: 42,
  topFactors: [
    { factor: 'Strong Q4 earnings beat expectations', source: 'Reuters', impact: 'positive' },
    { factor: 'Supply chain concerns in Asia', source: 'Bloomberg', impact: 'negative' },
    { factor: 'New product launch momentum', source: 'CNBC', impact: 'positive' },
  ],
  dataSufficient: true,
}

const MOCK_FUNDAMENTAL: FundamentalAnalysis = {
  pe: 29.4,
  pb: 45.2,
  debtToEquity: 1.87,
  roe: 160.9,
  fcfYield: 3.4,
  sectorMedians: { pe: 25.1, pb: 8.3, debtToEquity: 1.2, roe: 18.5, fcfYield: 4.1 },
  healthRating: 'Strong',
  summary:
    'Strong profitability with industry-leading ROE. Premium valuation justified by consistent growth and cash flow generation.',
  isStale: false,
}

const MOCK_TECHNICAL: TechnicalAnalysis = {
  sma50: 172.45,
  sma200: 165.32,
  rsi: 58.3,
  macd: { macd: 1.24, signal: 0.87, histogram: 0.37 },
  bollingerBands: { upper: 185.2, middle: 175.1, lower: 165.0 },
  indicators: [
    { name: '50-day SMA', value: '172.45', signal: 'bullish' },
    { name: '200-day SMA', value: '165.32', signal: 'bullish' },
    { name: 'RSI(14)', value: '58.3', signal: 'neutral' },
    { name: 'MACD', value: '1.24', signal: 'bullish' },
    { name: 'Bollinger Bands', value: '165-185', signal: 'neutral' },
  ],
}

const MOCK_NEWS: NewsAnalysis = {
  articles: [
    {
      title: 'Company Reports Record Revenue in Q4 Earnings Call',
      source: 'Reuters',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      impactRating: 'High',
      impactDirection: 'Positive',
    },
    {
      title: 'Analysts Raise Price Targets Following Strong Guidance',
      source: 'Bloomberg',
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      impactRating: 'Medium',
      impactDirection: 'Positive',
    },
    {
      title: 'New Regulatory Framework Could Impact Sector Margins',
      source: 'WSJ',
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      impactRating: 'Medium',
      impactDirection: 'Negative',
    },
    {
      title: 'Industry Conference Highlights Innovation Pipeline',
      source: 'TechCrunch',
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      impactRating: 'Low',
      impactDirection: 'Neutral',
    },
  ],
}

const MOCK_ANALYST: AnalystAnalysis = {
  consensus: 'Buy',
  avgPriceTarget: 195.0,
  priceTargetLow: 155.0,
  priceTargetHigh: 230.0,
  analystCount: 38,
  limitedCoverage: false,
}

const MOCK_COMPOSITE: CompositeScore = {
  score: 74,
  color: 'green',
  breakdown: {
    sentiment: 71,
    fundamental: 82,
    technical: 68,
    news: 75,
    analyst: 80,
  },
  missingDimensions: [],
}

export default function StockAnalysisPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const upperTicker = (ticker ?? '').toUpperCase()

  const analysis = useAnalysisStore((s) => s.getAnalysis(upperTicker))
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis)
  const setLoading = useAnalysisStore((s) => s.setLoading)

  const stockInfo = MOCK_STOCK_INFO[upperTicker] ?? {
    name: upperTicker,
    price: 0,
    change: 0,
    changePercent: 0,
  }

  // TODO: Replace with real API calls
  const loadAnalysis = useCallback(() => {
    const dimensions = ['sentiment', 'fundamental', 'technical', 'news', 'analyst', 'composite']
    dimensions.forEach((d) => setLoading(upperTicker, d, true))

    // Simulate staggered API responses
    setTimeout(() => {
      setAnalysis(upperTicker, { sentiment: MOCK_SENTIMENT })
      setLoading(upperTicker, 'sentiment', false)
    }, 600)

    setTimeout(() => {
      setAnalysis(upperTicker, { technical: MOCK_TECHNICAL })
      setLoading(upperTicker, 'technical', false)
    }, 800)

    setTimeout(() => {
      setAnalysis(upperTicker, { fundamental: MOCK_FUNDAMENTAL })
      setLoading(upperTicker, 'fundamental', false)
    }, 1000)

    setTimeout(() => {
      setAnalysis(upperTicker, { news: MOCK_NEWS })
      setLoading(upperTicker, 'news', false)
    }, 1200)

    setTimeout(() => {
      setAnalysis(upperTicker, { analyst: MOCK_ANALYST })
      setLoading(upperTicker, 'analyst', false)
    }, 1400)

    setTimeout(() => {
      setAnalysis(upperTicker, { composite: MOCK_COMPOSITE })
      setLoading(upperTicker, 'composite', false)
    }, 1600)
  }, [upperTicker, setAnalysis, setLoading])

  useEffect(() => {
    if (!analysis) {
      loadAnalysis()
    }
  }, [analysis, loadAnalysis])

  const loading = analysis?.loading ?? {}
  const errors = analysis?.errors ?? {}

  const isPositive = stockInfo.change >= 0

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-4xl font-bold tracking-tighter text-zinc-950">{upperTicker}</h1>
          <span className="text-lg text-zinc-500">{stockInfo.name}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-semibold tracking-tight text-zinc-950">
            ${stockInfo.price.toFixed(2)}
          </span>
          <span
            className={
              isPositive
                ? 'text-sm font-medium text-emerald-600'
                : 'text-sm font-medium text-rose-500'
            }
          >
            {isPositive ? '+' : ''}
            {stockInfo.change.toFixed(2)} ({isPositive ? '+' : ''}
            {stockInfo.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:grid-rows-[minmax(320px,auto)_minmax(280px,auto)_minmax(260px,auto)]">
        {/* Row 1: Technical (wide+tall) | Sentiment (tall) */}
        <div
          className="md:col-span-2 md:row-span-1"
          style={{ animationDelay: '100ms' }}
        >
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '100ms' }}>
            <TechnicalCard
              data={analysis?.technical}
              loading={loading.technical}
              error={errors.technical}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>
        <div className="md:col-span-1 md:row-span-1">
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '200ms' }}>
            <SentimentCard
              data={analysis?.sentiment}
              loading={loading.sentiment}
              error={errors.sentiment}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>

        {/* Row 2: Fundamental | News (wide) */}
        <div className="md:col-span-1 md:row-span-1">
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '300ms' }}>
            <FundamentalCard
              data={analysis?.fundamental}
              loading={loading.fundamental}
              error={errors.fundamental}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>
        <div className="md:col-span-2 md:row-span-1">
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '400ms' }}>
            <NewsCard
              data={analysis?.news}
              loading={loading.news}
              error={errors.news}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>

        {/* Row 3: Analyst (wide) | Composite Score */}
        <div className="md:col-span-2 md:row-span-1">
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '500ms' }}>
            <AnalystCard
              data={analysis?.analyst}
              currentPrice={stockInfo.price}
              loading={loading.analyst}
              error={errors.analyst}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>
        <div className="md:col-span-1 md:row-span-1">
          <CardShell className="animate-fade-in-up h-full" style={{ animationDelay: '600ms' }}>
            <CompositeScoreBadge
              data={analysis?.composite}
              loading={loading.composite}
              error={errors.composite}
              onRetry={loadAnalysis}
            />
          </CardShell>
        </div>
      </div>
    </div>
  )
}

function CardShell({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`rounded-[2rem] border border-zinc-200/50 bg-white p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ${className ?? ''}`}
      style={style}
    >
      {children}
    </div>
  )
}
