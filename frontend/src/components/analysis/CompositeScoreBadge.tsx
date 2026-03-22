import type { CompositeScore } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'

interface CompositeScoreBadgeProps {
  data?: CompositeScore
  loading?: boolean
  error?: string
  onRetry?: () => void
  compact?: boolean
}

const dimensionLabels: Record<string, string> = {
  sentiment: 'Sentiment',
  fundamental: 'Fundamental',
  technical: 'Technical',
  news: 'News',
  analyst: 'Analyst',
}

function getScoreColor(score: number): {
  ring: string
  text: string
  bg: string
  stroke: string
} {
  if (score >= 70)
    return {
      ring: 'stroke-emerald-500',
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
      stroke: '#10b981',
    }
  if (score >= 40)
    return {
      ring: 'stroke-amber-500',
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      stroke: '#f59e0b',
    }
  return {
    ring: 'stroke-rose-500',
    text: 'text-rose-500',
    bg: 'bg-rose-50',
    stroke: '#f43f5e',
  }
}

export function CompositeScoreBadge({
  data,
  loading,
  error,
  onRetry,
  compact = false,
}: CompositeScoreBadgeProps) {
  if (loading) {
    return <CompositeSkeleton compact={compact} />
  }

  if (error) {
    return <ErrorState message="Score unavailable" onRetry={onRetry} />
  }

  if (!data) {
    return <ErrorState message="No composite score" />
  }

  const colors = getScoreColor(data.score)

  // SVG circle parameters
  const size = compact ? 64 : 120
  const strokeWidth = compact ? 4 : 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (data.score / 100) * circumference

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f4f4f5"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className={cn('text-lg font-bold', colors.text)}>{data.score}</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center">
      <h3 className="mb-1 self-start text-sm font-semibold text-zinc-950">Composite Score</h3>

      {/* Circular score */}
      <div className="relative mt-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f4f4f5"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold tracking-tight', colors.text)}>
            {data.score}
          </span>
          <span className="text-[11px] text-zinc-400">/ 100</span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="mt-5 w-full flex-1 space-y-2.5">
        {Object.entries(dimensionLabels).map(([key, label]) => {
          const value = data.breakdown[key as keyof typeof data.breakdown]
          const isMissing = data.missingDimensions.includes(key)

          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">{label}</span>
                {!isMissing && value !== null ? (
                  <span className="text-[11px] font-medium text-zinc-700">{value}</span>
                ) : (
                  <span className="text-[11px] text-zinc-300">--</span>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                {isMissing || value === null ? (
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #d4d4d8 0, #d4d4d8 4px, transparent 4px, transparent 8px)',
                    }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${value}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompositeSkeleton({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-8" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center">
      <Skeleton className="h-4 w-28 self-start" />
      <Skeleton className="mt-4 h-[120px] w-[120px] rounded-full" />
      <div className="mt-5 w-full space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div className="mb-1 flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-6" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
