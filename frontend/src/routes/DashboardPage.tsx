import { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  PieChart,
  BarChart3,
  ArrowRight,
  Plus,
  Briefcase,
  Shield,
  Target,
  ChevronRight,
  Layers,
  Clock,
} from 'lucide-react'
import { usePortfolioStore, type Portfolio } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { usePreferencesStore } from '@/stores/preferencesStore'

/* ------------------------------------------------------------------ */
/*  Shimmer skeleton for loading states                                */
/* ------------------------------------------------------------------ */
function ShimmerCard() {
  return (
    <div className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8 space-y-4 animate-pulse">
      <div className="h-5 w-2/3 rounded-lg bg-zinc-100" />
      <div className="h-4 w-1/2 rounded-lg bg-zinc-100" />
      <div className="flex gap-2 mt-4">
        <div className="h-8 w-16 rounded-full bg-zinc-100" />
        <div className="h-8 w-16 rounded-full bg-zinc-100" />
        <div className="h-8 w-20 rounded-full bg-zinc-100" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mini donut chart (SVG) for sector breakdown                        */
/* ------------------------------------------------------------------ */
function MiniDonut({ sectors }: { sectors: Record<string, number> }) {
  const entries = Object.entries(sectors)
  if (entries.length === 0) return null

  const colors = [
    '#059669', '#0d9488', '#6366f1', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
    '#06b6d4',
  ]

  const total = entries.reduce((s, [, v]) => s + v, 0)
  let cumulative = 0

  return (
    <svg width="40" height="40" viewBox="0 0 36 36" className="shrink-0">
      {entries.map(([sector, value], i) => {
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
            stroke={colors[i % colors.length]}
            strokeWidth="4"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={offset}
            className="transition-all"
          />
        )
      })}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Score badge                                                        */
/* ------------------------------------------------------------------ */
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 60
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score.toFixed(0)}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Diversification gauge                                              */
/* ------------------------------------------------------------------ */
function DiversificationGauge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 max-w-[80px] rounded-full bg-zinc-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </div>
      <span className="text-xs font-medium text-zinc-500">{score}%</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Card animation variants                                            */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

/* ------------------------------------------------------------------ */
/*  Build flow – Generated portfolio card                              */
/* ------------------------------------------------------------------ */
function GeneratedPortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const navigate = useNavigate()
  const recs = portfolio.recommendations ?? []
  const sectorMap = recs.reduce<Record<string, number>>((acc, r) => {
    acc[r.sector] = (acc[r.sector] ?? 0) + r.allocationPct
    return acc
  }, {})
  const avgScore =
    recs.length > 0
      ? recs.reduce((s, r) => s + (r.compositeScore ?? 0), 0) / recs.length
      : 0

  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/build/${portfolio.id}`)}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8 text-left w-full transition-shadow hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-950 truncate">{portfolio.name}</h3>
          <p className="text-sm text-zinc-500 mt-1">
            {recs.length} stock{recs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <MiniDonut sectors={sectorMap} />
      </div>

      <div className="flex items-center gap-3 mt-5 flex-wrap">
        {avgScore > 0 && (
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Score</span>
            <ScoreBadge score={avgScore} />
          </div>
        )}
        <span className="text-xs text-zinc-400">
          {new Date(portfolio.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Analyze flow – Imported portfolio card                             */
/* ------------------------------------------------------------------ */
function ImportedPortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const navigate = useNavigate()
  const holdings = portfolio.holdings ?? []
  const sectors = holdings.reduce<Set<string>>((s, h) => {
    if (h.sector) s.add(h.sector)
    return s
  }, new Set())
  const diversificationScore = Math.min(100, Math.round((sectors.size / 11) * 100))

  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/analyze/${portfolio.id}`)}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8 text-left w-full transition-shadow hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-950 truncate">{portfolio.name}</h3>
          <p className="text-sm text-zinc-500 mt-1">
            {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="shrink-0 h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
          <Briefcase className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">Diversification</span>
        </div>
        <DiversificationGauge score={diversificationScore} />
      </div>

      <div className="flex gap-1.5 mt-4 flex-wrap">
        {Array.from(sectors)
          .slice(0, 3)
          .map((s) => (
            <span
              key={s}
              className="text-[10px] font-medium text-zinc-500 bg-zinc-50 rounded-full px-2 py-0.5"
            >
              {s}
            </span>
          ))}
        {sectors.size > 3 && (
          <span className="text-[10px] font-medium text-zinc-400">+{sectors.size - 3}</span>
        )}
      </div>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState({
  flow,
  onAction,
}: {
  flow: 'build' | 'analyze'
  onAction: () => void
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-12 flex flex-col items-center text-center"
    >
      <div className="h-20 w-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        {flow === 'build' ? (
          <Layers className="h-9 w-9 text-zinc-300" />
        ) : (
          <Briefcase className="h-9 w-9 text-zinc-300" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-zinc-950">
        {flow === 'build' ? 'Create your first portfolio' : 'Import your first portfolio'}
      </h3>
      <p className="text-sm text-zinc-500 mt-2 max-w-xs">
        {flow === 'build'
          ? 'Set your investment preferences and let AI generate a tailored portfolio for you.'
          : 'Import your existing brokerage portfolio to get health analysis and improvement suggestions.'}
      </p>
      <button
        onClick={onAction}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
      >
        {flow === 'build' ? (
          <>
            <Plus className="h-4 w-4" /> Generate Portfolio
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Import Portfolio
          </>
        )}
      </button>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  CTA card (generate / import)                                       */
/* ------------------------------------------------------------------ */
function CTACard({ flow, onClick }: { flow: 'build' | 'analyze'; onClick: () => void }) {
  return (
    <motion.button
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full rounded-[2rem] p-[2px] bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]"
    >
      <div className="bg-white rounded-[calc(2rem-2px)] p-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Plus className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="text-left min-w-0">
          <span className="text-sm font-semibold text-zinc-950">
            {flow === 'build' ? 'Generate New Portfolio' : 'Import Portfolio'}
          </span>
          <p className="text-xs text-zinc-500 mt-0.5">
            {flow === 'build'
              ? 'AI-powered portfolio based on your preferences'
              : 'Connect or upload your brokerage data'}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-emerald-600 shrink-0 ml-auto" />
      </div>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Quick actions                                                      */
/* ------------------------------------------------------------------ */
const quickActions = [
  { label: 'Compare Stocks', icon: BarChart3, href: '/compare' },
  { label: 'Edit Preferences', icon: Target, href: '/preferences' },
  { label: 'Portfolio Health', icon: Shield, href: '/analyze' },
  { label: 'Stock Analysis', icon: TrendingUp, href: '/stocks/AAPL' },
]

function QuickActionsCard() {
  return (
    <motion.div
      variants={cardVariants}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8"
    >
      <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-5">
        Quick Actions
      </h2>
      <div className="space-y-1">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors group"
          >
            <action.icon className="h-4 w-4 text-zinc-400 group-hover:text-emerald-600 transition-colors" />
            <span className="flex-1">{action.label}</span>
            <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recent activity placeholder                                        */
/* ------------------------------------------------------------------ */
function RecentActivityCard() {
  return (
    <motion.div
      variants={cardVariants}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8"
    >
      <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-5">
        Recent Activity
      </h2>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-50 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-zinc-300" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 rounded bg-zinc-50" />
              <div className="h-2.5 w-1/2 rounded bg-zinc-50" />
            </div>
          </div>
        ))}
        <p className="text-xs text-zinc-400 text-center pt-2">Activity will appear here</p>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Flow toggle                                                        */
/* ------------------------------------------------------------------ */
function FlowToggle() {
  const { activeFlow, setActiveFlow } = useUIStore()

  return (
    <div className="inline-flex rounded-full bg-zinc-100 p-1">
      {(['build', 'analyze'] as const).map((flow) => (
        <button
          key={flow}
          onClick={() => setActiveFlow(flow)}
          className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            activeFlow === flow ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          {activeFlow === flow && (
            <motion.div
              layoutId="flow-toggle"
              className="absolute inset-0 rounded-full bg-white shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 capitalize">{flow}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main dashboard page                                                */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { activeFlow } = useUIStore()
  const { portfolios } = usePortfolioStore()
  const { preferences, isLoaded } = usePreferencesStore()

  const filtered = useMemo(
    () =>
      portfolios.filter((p) =>
        activeFlow === 'build' ? p.type === 'generated' : p.type === 'imported'
      ),
    [portfolios, activeFlow]
  )

  const totalValue = useMemo(() => {
    return portfolios.reduce((sum, p) => {
      const holdingsVal = (p.holdings ?? []).reduce(
        (s, h) => s + (h.currentPrice ?? 0) * h.quantity,
        0
      )
      return sum + holdingsVal
    }, 0)
  }, [portfolios])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const handleCTA = () => {
    if (activeFlow === 'build') {
      if (!preferences.riskTolerance && !isLoaded) {
        navigate('/onboarding')
      } else {
        navigate('/build')
      }
    } else {
      navigate('/analyze/import')
    }
  }

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="mb-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
              {greeting}
            </h1>
            <p className="mt-1.5 text-zinc-500 text-sm sm:text-base">
              Here&rsquo;s an overview of your portfolio intelligence.
            </p>
          </div>
          <FlowToggle />
        </div>

        {/* Quick stats row */}
        <div className="flex flex-wrap gap-6 mt-8">
          {[
            {
              label: 'Portfolios',
              value: portfolios.length.toString(),
              icon: PieChart,
            },
            {
              label: 'Generated',
              value: portfolios.filter((p) => p.type === 'generated').length.toString(),
              icon: Layers,
            },
            {
              label: 'Imported',
              value: portfolios.filter((p) => p.type === 'imported').length.toString(),
              icon: Briefcase,
            },
            ...(totalValue > 0
              ? [
                  {
                    label: 'Total Value',
                    value: `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                    icon: TrendingUp,
                  },
                ]
              : []),
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{stat.label}</p>
                <p className="text-lg font-semibold text-zinc-950 leading-tight">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Asymmetric layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-start">
        {/* Left column – 60 % */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFlow}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="space-y-5"
          >
            <motion.h2
              variants={cardVariants}
              className="text-sm font-semibold text-zinc-950 uppercase tracking-wider"
            >
              {activeFlow === 'build' ? 'Generated Portfolios' : 'Imported Portfolios'}
            </motion.h2>

            {/* Loading skeleton */}
            {!isLoaded && filtered.length === 0 && (
              <div className="space-y-5">
                <ShimmerCard />
                <ShimmerCard />
              </div>
            )}

            {/* Empty state */}
            {isLoaded && filtered.length === 0 && (
              <EmptyState flow={activeFlow} onAction={handleCTA} />
            )}

            {/* Portfolio cards */}
            {filtered.length > 0 && (
              <>
                {filtered.map((p) =>
                  activeFlow === 'build' ? (
                    <GeneratedPortfolioCard key={p.id} portfolio={p} />
                  ) : (
                    <ImportedPortfolioCard key={p.id} portfolio={p} />
                  )
                )}
                <CTACard flow={activeFlow} onClick={handleCTA} />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Right column – 40 % */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6 lg:sticky lg:top-8"
        >
          <QuickActionsCard />
          <RecentActivityCard />
        </motion.div>
      </div>
    </div>
  )
}
