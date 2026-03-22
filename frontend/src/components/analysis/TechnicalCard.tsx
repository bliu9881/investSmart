import type { TechnicalAnalysis } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'

interface TechnicalCardProps {
  data?: TechnicalAnalysis
  loading?: boolean
  error?: string
  onRetry?: () => void
}

const signalConfig = {
  bullish: { label: 'Bullish', dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  bearish: { label: 'Bearish', dot: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-50' },
  neutral: { label: 'Neutral', dot: 'bg-zinc-400', text: 'text-zinc-600', bg: 'bg-zinc-100' },
}

export function TechnicalCard({ data, loading, error, onRetry }: TechnicalCardProps) {
  if (loading) {
    return <TechnicalSkeleton />
  }

  if (error) {
    return <ErrorState message="Analysis unavailable" onRetry={onRetry} />
  }

  if (!data) {
    return <ErrorState message="No technical data available" />
  }

  // Build display indicators from raw data + pre-built indicators
  const displayIndicators = buildIndicators(data)

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-1 text-sm font-semibold text-zinc-950">Technical</h3>

      {/* Mini sparkline placeholder */}
      <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100/50 border border-zinc-100">
        <div className="flex items-end gap-[3px]">
          {/* Stylized mini bar chart placeholder */}
          {[40, 55, 45, 70, 60, 80, 65, 75, 85, 70, 90, 78].map((h, i) => (
            <div
              key={i}
              className="w-2 rounded-sm bg-emerald-500/20 transition-all duration-500"
              style={{ height: `${h * 0.6}px`, animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        <span className="ml-3 text-[11px] text-zinc-400">Chart placeholder</span>
      </div>

      {/* Indicators list */}
      <div className="mt-4 flex-1 space-y-2">
        {displayIndicators.map((ind, i) => {
          const config = signalConfig[ind.signal]
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-zinc-50/50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', config.dot)} />
                <span className="text-sm text-zinc-700">{ind.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-950">{ind.value}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    config.bg,
                    config.text
                  )}
                >
                  {config.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildIndicators(data: TechnicalAnalysis) {
  // If the store already has pre-built indicators, use those
  if (data.indicators && data.indicators.length > 0) {
    return data.indicators
  }

  // Otherwise, build from raw fields
  const indicators: { name: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }[] = []

  if (data.sma50 !== null) {
    indicators.push({
      name: '50-day SMA',
      value: data.sma50.toFixed(2),
      signal: 'neutral',
    })
  }

  if (data.sma200 !== null) {
    indicators.push({
      name: '200-day SMA',
      value: data.sma200.toFixed(2),
      signal: 'neutral',
    })
  }

  if (data.rsi !== null) {
    indicators.push({
      name: 'RSI(14)',
      value: data.rsi.toFixed(1),
      signal: data.rsi > 70 ? 'bearish' : data.rsi < 30 ? 'bullish' : 'neutral',
    })
  }

  if (data.macd !== null) {
    indicators.push({
      name: 'MACD',
      value: data.macd.macd.toFixed(2),
      signal: data.macd.histogram > 0 ? 'bullish' : data.macd.histogram < 0 ? 'bearish' : 'neutral',
    })
  }

  if (data.bollingerBands !== null) {
    const bb = data.bollingerBands
    indicators.push({
      name: 'Bollinger Bands',
      value: `${bb.lower.toFixed(0)}-${bb.upper.toFixed(0)}`,
      signal: 'neutral',
    })
  }

  return indicators
}

function TechnicalSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-24 w-full rounded-xl" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
