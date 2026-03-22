import type { NewsAnalysis } from '@/stores/analysisStore'
import { Skeleton } from '@/components/shared/SkeletonLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'

interface NewsCardProps {
  data?: NewsAnalysis
  loading?: boolean
  error?: string
  onRetry?: () => void
}

const impactColors: Record<string, string> = {
  High: 'bg-rose-50 text-rose-600',
  Medium: 'bg-amber-50 text-amber-600',
  Low: 'bg-zinc-100 text-zinc-500',
}

function DirectionArrow({ direction }: { direction: 'Positive' | 'Negative' | 'Neutral' }) {
  if (direction === 'Positive') {
    return (
      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
      </svg>
    )
  }
  if (direction === 'Negative') {
    return (
      <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12H6.75" />
    </svg>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NewsCard({ data, loading, error, onRetry }: NewsCardProps) {
  if (loading) {
    return <NewsSkeleton />
  }

  if (error) {
    return <ErrorState message="Analysis unavailable" onRetry={onRetry} />
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <h3 className="mb-1 text-sm font-semibold text-zinc-950">News</h3>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="No recent news"
            description="There are no relevant news articles for this stock right now."
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z" />
              </svg>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 text-sm font-semibold text-zinc-950">News</h3>

      <div className="flex-1 space-y-2">
        {data.articles.slice(0, 5).map((article, i) => (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-50"
          >
            <DirectionArrow direction={article.impactDirection} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-zinc-800 line-clamp-2 group-hover:text-zinc-950">
                {article.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">{article.source}</span>
                <span className="text-zinc-300">&middot;</span>
                <span className="text-[11px] text-zinc-400">{formatDate(article.publishedAt)}</span>
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                impactColors[article.impactRating]
              )}
            >
              {article.impactRating}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewsSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-4 w-12" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
