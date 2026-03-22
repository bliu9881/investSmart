import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  RefreshCw,
  Save,
  X,
  ChevronRight,
  PieChart,
  Shield,
  BarChart3,
  Check,
} from 'lucide-react'
import { usePortfolioStore, type Recommendation } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CARD =
  'bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8'

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#059669',
  Healthcare: '#0d9488',
  Financials: '#6366f1',
  'Consumer Staples': '#f59e0b',
  Utilities: '#ef4444',
  'Real Estate': '#8b5cf6',
  Energy: '#ec4899',
  Industrials: '#14b8a6',
  'Consumer Discretionary': '#f97316',
  Materials: '#64748b',
  'Communication Services': '#06b6d4',
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
  exit: {
    opacity: 0,
    x: -60,
    height: 0,
    padding: 0,
    marginTop: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

/* ------------------------------------------------------------------ */
/*  Skeleton loading state                                             */
/* ------------------------------------------------------------------ */
function SkeletonState() {
  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto">
      <div className="animate-pulse space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-zinc-100" />
          <div className="space-y-2">
            <div className="h-6 w-64 rounded-lg bg-zinc-100" />
            <div className="h-4 w-40 rounded-lg bg-zinc-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${CARD} animate-pulse space-y-3`}>
                <div className="h-5 w-1/3 rounded bg-zinc-100" />
                <div className="h-4 w-2/3 rounded bg-zinc-100" />
                <div className="h-3 w-full rounded bg-zinc-100" />
              </div>
            ))}
          </div>
          <div className={`${CARD} animate-pulse space-y-4`}>
            <div className="h-5 w-1/2 rounded bg-zinc-100" />
            <div className="h-40 w-40 mx-auto rounded-full bg-zinc-100" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-full rounded bg-zinc-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Donut chart                                                        */
/* ------------------------------------------------------------------ */
function SectorDonut({ sectors }: { sectors: Record<string, number> }) {
  const entries = Object.entries(sectors).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, v]) => s + v, 0)
  let cumulative = 0

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 36 36" className="shrink-0">
        {entries.map(([sector, value]) => {
          const pct = (value / total) * 100
          const offset = 100 - cumulative
          cumulative += pct
          return (
            <circle
              key={sector}
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke={SECTOR_COLORS[sector] ?? '#94a3b8'}
              strokeWidth="3.5"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          )
        })}
        <text
          x="18"
          y="17"
          textAnchor="middle"
          className="fill-zinc-950 text-[3.5px] font-semibold"
        >
          {entries.length}
        </text>
        <text
          x="18"
          y="21"
          textAnchor="middle"
          className="fill-zinc-400 text-[2.5px]"
        >
          sectors
        </text>
      </svg>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
        {entries.map(([sector, value]) => (
          <div key={sector} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: SECTOR_COLORS[sector] ?? '#94a3b8' }}
            />
            <span className="text-xs text-zinc-600 truncate">{sector}</span>
            <span className="text-xs font-medium text-zinc-950 ml-auto">
              {value.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recommendation card                                                */
/* ------------------------------------------------------------------ */
function RecommendationCard({
  rec,
  checked,
  onToggleCheck,
  onRemove,
}: {
  rec: Recommendation
  checked: boolean
  onToggleCheck: () => void
  onRemove: () => void
}) {
  const navigate = useNavigate()

  return (
    <motion.div
      layout
      variants={cardVariants}
      exit="exit"
      className={`${CARD} relative group cursor-pointer`}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleCheck()
          }}
          className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            checked
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-zinc-300 hover:border-emerald-400'
          }`}
        >
          {checked && <Check className="h-3 w-3 text-white" />}
        </button>

        {/* Content */}
        <div
          className="flex-1 min-w-0"
          onClick={() => navigate(`/stocks/${rec.ticker}`)}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white tracking-wide">
              {rec.ticker}
            </span>
            <span className="text-sm font-semibold text-zinc-950 truncate">
              {rec.companyName}
            </span>
            <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5">
              {rec.sector}
            </span>
          </div>

          {/* Allocation bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${rec.allocationPct}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              />
            </div>
            <span className="text-xs font-semibold text-zinc-950 w-10 text-right">
              {rec.allocationPct}%
            </span>
          </div>

          <p className="text-sm text-zinc-500 mt-3 line-clamp-2">
            {rec.rationale}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {rec.compositeScore !== undefined && rec.compositeScore > 0 && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  rec.compositeScore >= 80
                    ? 'bg-emerald-50 text-emerald-700'
                    : rec.compositeScore >= 60
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                }`}
              >
                Score: {rec.compositeScore}
              </span>
            )}
            <span className="inline-flex items-center text-xs text-emerald-600 font-medium gap-0.5">
              View Analysis <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full bg-zinc-50 hover:bg-rose-50 flex items-center justify-center shrink-0"
        >
          <X className="h-4 w-4 text-zinc-400 hover:text-rose-500" />
        </button>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function PortfolioNotFound() {
  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto flex flex-col items-center justify-center">
      <div className="h-20 w-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        <PieChart className="h-9 w-9 text-zinc-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950">
        Portfolio not found
      </h2>
      <p className="text-sm text-zinc-500 mt-2">
        This portfolio may have been removed or doesn&rsquo;t exist.
      </p>
      <Link
        to="/build"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
      >
        Generate New Portfolio
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function PortfolioDetailPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const navigate = useNavigate()
  const { portfolios, updatePortfolio, setGenerating } = usePortfolioStore()
  const { addComparisonTicker, clearComparisonTickers } = useUIStore()

  const portfolio = useMemo(
    () => portfolios.find((p) => p.id === portfolioId) ?? null,
    [portfolios, portfolioId]
  )

  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    () => portfolio?.recommendations ?? []
  )
  const [checkedTickers, setCheckedTickers] = useState<Set<string>>(new Set())
  const [isLoading] = useState(false)

  // Sector allocation map
  const sectorMap = useMemo(() => {
    return recommendations.reduce<Record<string, number>>((acc, r) => {
      acc[r.sector] = (acc[r.sector] ?? 0) + r.allocationPct
      return acc
    }, {})
  }, [recommendations])

  const riskLevel = portfolio?.preferenceSnapshot?.riskTolerance ?? 'Moderate'

  const handleRemove = useCallback(
    (ticker: string) => {
      const toRemove = recommendations.find((r) => r.ticker === ticker)
      if (!toRemove) return

      const remaining = recommendations.filter((r) => r.ticker !== ticker)
      if (remaining.length === 0) {
        setRecommendations([])
        return
      }

      // Redistribute the removed allocation proportionally
      const removedPct = toRemove.allocationPct
      const totalRemaining = remaining.reduce((s, r) => s + r.allocationPct, 0)

      const redistributed = remaining.map((r) => ({
        ...r,
        allocationPct: Math.round(
          r.allocationPct + (r.allocationPct / totalRemaining) * removedPct
        ),
      }))

      // Fix rounding so it sums to 100
      const sum = redistributed.reduce((s, r) => s + r.allocationPct, 0)
      if (sum !== 100 && redistributed.length > 0) {
        redistributed[0].allocationPct += 100 - sum
      }

      setRecommendations(redistributed)
      setCheckedTickers((prev) => {
        const next = new Set(prev)
        next.delete(ticker)
        return next
      })
    },
    [recommendations]
  )

  const handleToggleCheck = useCallback((ticker: string) => {
    setCheckedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  const handleCompare = useCallback(() => {
    clearComparisonTickers()
    checkedTickers.forEach((t) => addComparisonTicker(t))
    navigate('/compare')
  }, [checkedTickers, clearComparisonTickers, addComparisonTicker, navigate])

  const handleSave = useCallback(() => {
    if (!portfolioId) return
    updatePortfolio(portfolioId, { recommendations })
  }, [portfolioId, recommendations, updatePortfolio])

  const handleRegenerate = useCallback(() => {
    setGenerating(true)
    navigate('/build')
  }, [setGenerating, navigate])

  if (isLoading) return <SkeletonState />
  if (!portfolio) return <PortfolioNotFound />

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="mb-10"
      >
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
              {portfolio.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-zinc-500">
                Created{' '}
                {new Date(portfolio.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  riskLevel === 'Conservative'
                    ? 'bg-blue-50 text-blue-700'
                    : riskLevel === 'Aggressive'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                <Shield className="h-3 w-3" />
                {riskLevel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerate}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Regenerate
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-start">
        {/* Left column — recommendations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider">
              Recommendations ({recommendations.length})
            </h2>
            {checkedTickers.size >= 2 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleCompare}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Compare Selected ({checkedTickers.size})
              </motion.button>
            )}
          </div>

          {recommendations.length === 0 && (
            <div className={`${CARD} text-center py-12`}>
              <div className="h-16 w-16 mx-auto rounded-full bg-zinc-50 flex items-center justify-center mb-4">
                <PieChart className="h-7 w-7 text-zinc-300" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-950">
                All recommendations removed
              </h3>
              <p className="text-sm text-zinc-500 mt-2">
                Regenerate the portfolio to get new recommendations.
              </p>
            </div>
          )}

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.ticker}
                  rec={rec}
                  checked={checkedTickers.has(rec.ticker)}
                  onToggleCheck={() => handleToggleCheck(rec.ticker)}
                  onRemove={() => handleRemove(rec.ticker)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right column — summary */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.15 }}
          className="space-y-6 lg:sticky lg:top-8"
        >
          {/* Summary stats */}
          <div className={CARD}>
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
              Portfolio Summary
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Total Stocks</p>
                <p className="text-2xl font-semibold text-zinc-950">
                  {recommendations.length}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Sectors</p>
                <p className="text-2xl font-semibold text-zinc-950">
                  {Object.keys(sectorMap).length}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Risk Level</p>
                <p className="text-lg font-semibold text-zinc-950">
                  {riskLevel}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Avg Score</p>
                <p className="text-2xl font-semibold text-zinc-950">
                  {(() => {
                    const scored = recommendations.filter((r) => r.compositeScore && r.compositeScore > 0)
                    return scored.length > 0
                      ? (scored.reduce((s, r) => s + (r.compositeScore ?? 0), 0) / scored.length).toFixed(0)
                      : '—'
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Sector allocation */}
          <div className={CARD}>
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
              Sector Allocation
            </h2>
            <SectorDonut sectors={sectorMap} />
          </div>

          {/* Allocation breakdown list */}
          <div className={CARD}>
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-4">
              Allocation Breakdown
            </h2>
            <div className="space-y-3">
              {recommendations
                .sort((a, b) => b.allocationPct - a.allocationPct)
                .map((r) => (
                  <div key={r.ticker} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 w-12 text-center">
                      {r.ticker}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${r.allocationPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-zinc-600 w-8 text-right">
                      {r.allocationPct}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
