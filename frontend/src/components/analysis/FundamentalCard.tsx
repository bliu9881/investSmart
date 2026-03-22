import type { FundamentalAnalysis } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'

interface FundamentalCardProps {
  data?: FundamentalAnalysis
  loading?: boolean
  error?: string
  onRetry?: () => void
}

const METRIC_LABELS: Record<string, string> = {
  pe: 'P/E',
  pb: 'P/B',
  debtToEquity: 'D/E',
  roe: 'ROE',
  fcfYield: 'FCF Yield',
}

const METRIC_KEYS = ['pe', 'pb', 'debtToEquity', 'roe', 'fcfYield'] as const

function formatValue(key: string, value: number | null): string {
  if (value === null) return '--'
  if (key === 'roe' || key === 'fcfYield') return `${value.toFixed(1)}%`
  return value.toFixed(2)
}

function compareToMedian(
  key: string,
  value: number | null,
  medians: Record<string, number>
): 'above' | 'at' | 'below' | null {
  if (value === null) return null
  const median = medians[key]
  if (median === undefined) return null
  const ratio = value / median
  if (ratio > 1.1) return 'above'
  if (ratio < 0.9) return 'below'
  return 'at'
}

function ComparisonIndicator({ comparison }: { comparison: 'above' | 'at' | 'below' | null }) {
  if (!comparison) return <span className="text-zinc-300">--</span>

  const config = {
    above: { label: 'Above', color: 'text-emerald-600 bg-emerald-50' },
    at: { label: 'At', color: 'text-zinc-600 bg-zinc-100' },
    below: { label: 'Below', color: 'text-rose-500 bg-rose-50' },
  }

  const { label, color } = config[comparison]
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', color)}>{label}</span>
  )
}

export function FundamentalCard({ data, loading, error, onRetry }: FundamentalCardProps) {
  if (loading) {
    return <FundamentalSkeleton />
  }

  if (error) {
    return <ErrorState message="Analysis unavailable" onRetry={onRetry} />
  }

  if (!data) {
    return <ErrorState message="No fundamental data available" />
  }

  const healthColor =
    data.healthRating === 'Strong'
      ? 'bg-emerald-50 text-emerald-700'
      : data.healthRating === 'Moderate'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-600'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-950">Fundamentals</h3>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', healthColor)}>
          {data.healthRating}
        </span>
      </div>

      {data.isStale && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Data may be stale (older than 1 quarter)
        </div>
      )}

      {/* Ratios table */}
      <div className="mt-3 flex-1">
        <table className="w-full">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <th className="pb-2 text-left">Metric</th>
              <th className="pb-2 text-right">Value</th>
              <th className="pb-2 text-right">vs Sector</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {METRIC_KEYS.map((key) => {
              const value = data[key]
              const comparison = compareToMedian(key, value, data.sectorMedians)
              return (
                <tr key={key}>
                  <td className="py-2 text-sm text-zinc-600">{METRIC_LABELS[key]}</td>
                  <td className="py-2 text-right text-sm font-medium text-zinc-950">
                    {formatValue(key, value)}
                  </td>
                  <td className="py-2 text-right">
                    <ComparisonIndicator comparison={comparison} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {data.summary && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-sm leading-relaxed text-zinc-500">
          {data.summary}
        </p>
      )}
    </div>
  )
}

function FundamentalSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-12 w-full" />
    </div>
  )
}
