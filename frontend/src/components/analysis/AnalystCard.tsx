import type { AnalystAnalysis } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'

interface AnalystCardProps {
  data?: AnalystAnalysis
  currentPrice?: number
  loading?: boolean
  error?: string
  onRetry?: () => void
}

const consensusConfig: Record<
  string,
  { bg: string; text: string }
> = {
  'Strong Buy': { bg: 'bg-emerald-600', text: 'text-white' },
  Buy: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Hold: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Sell: { bg: 'bg-rose-100', text: 'text-rose-600' },
  'Strong Sell': { bg: 'bg-rose-500', text: 'text-white' },
}

export function AnalystCard({ data, currentPrice, loading, error, onRetry }: AnalystCardProps) {
  if (loading) {
    return <AnalystSkeleton />
  }

  if (error) {
    return <ErrorState message="Analysis unavailable" onRetry={onRetry} />
  }

  if (!data) {
    return <ErrorState message="No analyst data available" />
  }

  const config = consensusConfig[data.consensus] || consensusConfig.Hold

  // Calculate current price position on the range bar
  const rangeWidth = data.priceTargetHigh - data.priceTargetLow
  let currentPricePosition: number | null = null
  if (currentPrice !== undefined && rangeWidth > 0) {
    currentPricePosition = ((currentPrice - data.priceTargetLow) / rangeWidth) * 100
    currentPricePosition = Math.max(0, Math.min(100, currentPricePosition))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-950">Analyst Consensus</h3>
        {data.limitedCoverage && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
            Limited coverage
          </span>
        )}
      </div>

      {/* Consensus badge */}
      <div className="mt-4 flex items-center gap-3">
        <span
          className={cn(
            'rounded-xl px-4 py-2 text-lg font-bold',
            config.bg,
            config.text
          )}
        >
          {data.consensus}
        </span>
        <span className="text-sm text-zinc-500">
          {data.analystCount} analyst{data.analystCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Price target */}
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Price Target
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
          ${data.avgPriceTarget.toFixed(2)}
        </p>

        {/* Range bar */}
        <div className="mt-3">
          <div className="relative h-2 w-full rounded-full bg-zinc-100">
            {/* Filled range */}
            <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-200" />

            {/* Average target marker */}
            {rangeWidth > 0 && (
              <div
                className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900"
                style={{
                  left: `${((data.avgPriceTarget - data.priceTargetLow) / rangeWidth) * 100}%`,
                }}
              />
            )}

            {/* Current price marker */}
            {currentPricePosition !== null && (
              <div
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow-md"
                style={{ left: `${currentPricePosition}%` }}
              >
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  ${currentPrice?.toFixed(0)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
            <span>${data.priceTargetLow.toFixed(0)}</span>
            <span>${data.priceTargetHigh.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalystSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-24" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
      </div>
    </div>
  )
}
