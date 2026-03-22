import type { SentimentAnalysis } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'

interface SentimentCardProps {
  data?: SentimentAnalysis
  loading?: boolean
  error?: string
  onRetry?: () => void
}

export function SentimentCard({ data, loading, error, onRetry }: SentimentCardProps) {
  if (loading) {
    return <SentimentSkeleton />
  }

  if (error) {
    return <ErrorState message="Analysis unavailable" onRetry={onRetry} />
  }

  if (!data) {
    return <ErrorState message="No sentiment data available" />
  }

  // Normalize score from [-100, 100] to [0, 100] for gauge positioning
  const normalizedPosition = ((data.score + 100) / 200) * 100

  const sentimentLabel =
    data.score >= 50
      ? 'Extreme Greed'
      : data.score >= 20
        ? 'Greed'
        : data.score >= -20
          ? 'Neutral'
          : data.score >= -50
            ? 'Fear'
            : 'Extreme Fear'

  const sentimentColor =
    data.score >= 20
      ? 'text-emerald-600'
      : data.score >= -20
        ? 'text-zinc-600'
        : 'text-rose-500'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-950">Sentiment</h3>
        {!data.dataSufficient && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
            Limited data
          </span>
        )}
      </div>

      {/* Score */}
      <div className="mt-4 text-center">
        <span className={cn('text-4xl font-bold tracking-tight', sentimentColor)}>
          {data.score > 0 ? '+' : ''}
          {data.score}
        </span>
        <p className={cn('mt-1 text-sm font-medium', sentimentColor)}>{sentimentLabel}</p>
      </div>

      {/* Gauge bar */}
      <div className="mt-5 px-1">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-rose-400 via-zinc-300 to-emerald-400">
          <div
            className="absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-md transition-all duration-700 ease-out"
            style={{ left: `${normalizedPosition}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
          <span>Fear</span>
          <span>Greed</span>
        </div>
      </div>

      {/* Top factors */}
      {data.topFactors.length > 0 && (
        <div className="mt-5 flex-1 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Top Factors
          </p>
          {data.topFactors.slice(0, 3).map((factor, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  factor.impact === 'positive'
                    ? 'bg-emerald-500'
                    : factor.impact === 'negative'
                      ? 'bg-rose-500'
                      : 'bg-zinc-400'
                )}
              />
              <div className="min-w-0">
                <p className="text-sm leading-snug text-zinc-700">{factor.factor}</p>
                <p className="text-[11px] text-zinc-400">{factor.source}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SentimentSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-4 w-20" />
      <div className="mt-6 flex flex-col items-center">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="mt-2 h-4 w-16" />
      </div>
      <Skeleton className="mt-6 h-2.5 w-full rounded-full" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    </div>
  )
}
