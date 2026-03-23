import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Wallet,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Upload,
  BarChart3,
  MessageCircle,
  Bot,
  Plus,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  Activity,
  RefreshCw,
  MoreVertical,
  Trash2,
  Eye,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { usePortfolioStore, type Portfolio } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { getMarketOverview, getStockPrices, type MarketData, type StockPrice } from '@/services/marketService'

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CARD =
  'bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50'

const SECTOR_COLORS = [
  '#059669', // emerald
  '#2563eb', // blue
  '#f59e0b', // amber
  '#9333ea', // purple
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
]

/* ------------------------------------------------------------------ */
/*  Shimmer skeleton                                                   */
/* ------------------------------------------------------------------ */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-zinc-100 animate-pulse ${className}`}
    />
  )
}

function ShimmerCard() {
  return (
    <div className={`${CARD} p-8 space-y-4`}>
      <Shimmer className="h-5 w-2/3" />
      <Shimmer className="h-4 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Shimmer className="h-8 w-16 rounded-full" />
        <Shimmer className="h-8 w-20 rounded-full" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function gainColor(gain: number): string {
  if (gain > 0) return 'text-emerald-600 bg-emerald-50'
  if (gain < 0) return 'text-red-600 bg-red-50'
  return 'text-zinc-500 bg-zinc-50'
}

/* ------------------------------------------------------------------ */
/*  Aggregated holding type                                            */
/* ------------------------------------------------------------------ */
interface AggregatedHolding {
  ticker: string
  company: string
  sector: string
  totalAllocation: number
  totalQuantity: number
  gainLoss: number // percentage
  currentPrice?: number
  dailyChangePct?: number
}

/* ------------------------------------------------------------------ */
/*  Main dashboard page                                                */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { portfolios, deleteFromServer } = usePortfolioStore()
  const { setChatOpen } = useUIStore()
  const { preferences, isLoaded } = usePreferencesStore()

  /* ---------- market data ---------- */
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)

  const refreshMarket = useCallback(async () => {
    setMarketLoading(true)
    try {
      const data = await getMarketOverview()
      setMarketData(data)
    } catch {
      // silently fail — market data is supplementary
    } finally {
      setMarketLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMarket()
  }, [refreshMarket])

  /* ---------- time-based greeting ---------- */
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  /* ---------- aggregate all holdings ---------- */
  const allHoldings = useMemo(() => {
    const map = new Map<string, AggregatedHolding>()

    for (const p of portfolios) {
      for (const r of p.recommendations ?? []) {
        const existing = map.get(r.ticker)
        if (existing) {
          existing.totalAllocation += r.allocationPct
        } else {
          map.set(r.ticker, {
            ticker: r.ticker,
            company: r.companyName,
            sector: r.sector,
            totalAllocation: r.allocationPct,
            totalQuantity: 0,
            gainLoss: 0,
          })
        }
      }
      for (const h of p.holdings ?? []) {
        const existing = map.get(h.ticker)
        const gl =
          h.currentPrice && h.costBasis && h.costBasis > 0
            ? ((h.currentPrice - h.costBasis) / h.costBasis) * 100
            : 0
        if (existing) {
          existing.totalQuantity += h.quantity
          // weighted average gain
          if (gl !== 0) existing.gainLoss = gl
          if (!existing.company && h.companyName) existing.company = h.companyName
          if (!existing.sector && h.sector) existing.sector = h.sector
        } else {
          map.set(h.ticker, {
            ticker: h.ticker,
            company: h.companyName ?? h.ticker,
            sector: h.sector ?? 'Other',
            totalAllocation: 0,
            totalQuantity: h.quantity,
            gainLoss: gl,
          })
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalAllocation - a.totalAllocation || b.totalQuantity - a.totalQuantity,
    )
  }, [portfolios])

  const top10 = useMemo(() => allHoldings.slice(0, 10), [allHoldings])

  /* ---------- stock prices ---------- */
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({})

  useEffect(() => {
    const tickers = [...new Set(allHoldings.map((h) => h.ticker))]
    if (tickers.length === 0) return
    getStockPrices(tickers).then(setStockPrices)
  }, [allHoldings])

  /* ---------- sector data for chart ---------- */
  const sectorData = useMemo(() => {
    const sectors: Record<string, number> = {}
    for (const h of allHoldings) {
      const s = h.sector || 'Other'
      sectors[s] = (sectors[s] ?? 0) + (h.totalAllocation || h.totalQuantity)
    }
    return Object.entries(sectors)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [allHoldings])

  const concentrationWarning = useMemo(() => {
    const total = sectorData.reduce((s, d) => s + d.value, 0)
    if (total === 0) return null
    const top = sectorData[0]
    if (!top) return null
    const pct = (top.value / total) * 100
    return pct > 40 ? top.name : null
  }, [sectorData])

  /* ---------- summary stats ---------- */
  const stats = useMemo(() => {
    const totalValue = portfolios.reduce((sum, p) => {
      const hVal = (p.holdings ?? []).reduce(
        (s, h) => s + (h.currentPrice ?? h.costBasis ?? 0) * h.quantity,
        0,
      )
      return sum + hVal
    }, 0)

    const generatedCount = portfolios.filter((p) => p.type === 'generated').length
    const importedCount = portfolios.filter((p) => p.type === 'imported').length

    let topGainer: AggregatedHolding | null = null
    let topLoser: AggregatedHolding | null = null
    for (const h of allHoldings) {
      if (!topGainer || h.gainLoss > topGainer.gainLoss) topGainer = h
      if (!topLoser || h.gainLoss < topLoser.gainLoss) topLoser = h
    }

    return {
      totalValue,
      portfolioCount: portfolios.length,
      generatedCount,
      importedCount,
      topGainer,
      topLoser,
    }
  }, [portfolios, allHoldings])

  const hasPortfolios = portfolios.length > 0

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto font-[Geist,system-ui,sans-serif]">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* ============================================================ */}
        {/*  1. Welcome + Summary Stats                                  */}
        {/* ============================================================ */}
        <motion.section variants={fadeUp}>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
            {greeting}
          </h1>
          <p className="mt-1.5 text-zinc-500 text-sm sm:text-base">
            Here&rsquo;s your investor dashboard at a glance.
          </p>

          {hasPortfolios ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {/* Total Value */}
              <div className={`${CARD} p-6`}>
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs text-zinc-500 font-medium">Total Value</p>
                <p className="text-xl font-semibold text-zinc-950 mt-0.5">
                  {stats.totalValue > 0 ? formatCurrency(stats.totalValue) : '--'}
                </p>
              </div>

              {/* Portfolios */}
              <div className={`${CARD} p-6`}>
                <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-xs text-zinc-500 font-medium">Portfolios</p>
                <p className="text-xl font-semibold text-zinc-950 mt-0.5">
                  {stats.portfolioCount}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {stats.generatedCount} generated, {stats.importedCount} imported
                </p>
              </div>

              {/* Top Gainer */}
              <div className={`${CARD} p-6`}>
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs text-zinc-500 font-medium">Top Gainer</p>
                {stats.topGainer && stats.topGainer.gainLoss > 0 ? (
                  <>
                    <p className="text-xl font-semibold text-zinc-950 mt-0.5">
                      {stats.topGainer.ticker}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                      +{stats.topGainer.gainLoss.toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400 mt-1">--</p>
                )}
              </div>

              {/* Top Loser */}
              <div className={`${CARD} p-6`}>
                <div className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-xs text-zinc-500 font-medium">Top Loser</p>
                {stats.topLoser && stats.topLoser.gainLoss < 0 ? (
                  <>
                    <p className="text-xl font-semibold text-zinc-950 mt-0.5">
                      {stats.topLoser.ticker}
                    </p>
                    <p className="text-[11px] text-red-600 font-medium mt-0.5">
                      {stats.topLoser.gainLoss.toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400 mt-1">--</p>
                )}
              </div>
            </div>
          ) : (
            /* Onboarding CTA when no portfolios */
            <motion.div
              variants={fadeUp}
              className={`${CARD} p-10 mt-8 flex flex-col sm:flex-row items-center gap-6`}
            >
              <div className="h-16 w-16 rounded-3xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Sparkles className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-zinc-950">
                  Build your first portfolio
                </h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-md">
                  Set your investment preferences and let AI generate a tailored
                  portfolio, or import your existing holdings.
                </p>
              </div>
              <button
                onClick={() => navigate('/build')}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors shrink-0"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.section>

        {/* ============================================================ */}
        {/*  2 + 3. Holdings Overview (60%) + Sector Allocation (40%)    */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8">
          {/* Holdings Overview */}
          <motion.section variants={fadeUp} className={`${CARD} p-8`}>
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
              Holdings Overview
            </h2>

            {!isLoaded ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Shimmer key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : top10.length === 0 ? (
              <div className="py-12 text-center">
                <Briefcase className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  No holdings yet. Import or generate a portfolio to see your
                  stocks here.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-400 font-medium">
                        <th className="pb-3 px-2">Ticker</th>
                        <th className="pb-3 px-2 hidden sm:table-cell">Company</th>
                        <th className="pb-3 px-2 hidden md:table-cell">Sector</th>
                        <th className="pb-3 px-2 text-right hidden lg:table-cell">Price</th>
                        <th className="pb-3 px-2 text-right hidden lg:table-cell">Daily</th>
                        <th className="pb-3 px-2 text-right">
                          {top10.some((h) => h.totalAllocation > 0) ? 'Alloc %' : 'Qty'}
                        </th>
                        <th className="pb-3 px-2 text-right">G/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {top10.map((h) => {
                        const sp = stockPrices[h.ticker]
                        return (
                        <tr
                          key={h.ticker}
                          className="group hover:bg-zinc-50/50 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <Link
                              to={`/stocks/${h.ticker}`}
                              className="font-semibold text-zinc-950 hover:text-emerald-600 transition-colors"
                            >
                              {h.ticker}
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-zinc-500 truncate max-w-[160px] hidden sm:table-cell">
                            {sp?.name || h.company}
                          </td>
                          <td className="py-3 px-2 hidden md:table-cell">
                            <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                              {sp?.sector || h.sector}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-zinc-700 hidden lg:table-cell">
                            {sp?.price != null ? `$${sp.price.toFixed(2)}` : '--'}
                          </td>
                          <td className="py-3 px-2 text-right hidden lg:table-cell">
                            {sp?.changePct != null ? (
                              <span className={`text-xs font-semibold ${sp.changePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {sp.changePct >= 0 ? '+' : ''}{sp.changePct.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">--</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-zinc-700">
                            {h.totalAllocation > 0
                              ? `${h.totalAllocation.toFixed(1)}%`
                              : h.totalQuantity}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${gainColor(h.gainLoss)}`}
                            >
                              {h.gainLoss > 0
                                ? `+${h.gainLoss.toFixed(1)}%`
                                : h.gainLoss < 0
                                  ? `${h.gainLoss.toFixed(1)}%`
                                  : '0%'}
                            </span>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {allHoldings.length > 10 && (
                  <div className="mt-4 text-center">
                    <Link
                      to="/analyze"
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1"
                    >
                      View all {allHoldings.length} holdings
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </>
            )}
          </motion.section>

          {/* Sector Allocation */}
          <motion.section variants={fadeUp} className={`${CARD} p-8`}>
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
              Sector Allocation
            </h2>

            {!isLoaded ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Shimmer className="h-48 w-48 rounded-full" />
                <Shimmer className="h-4 w-32" />
              </div>
            ) : sectorData.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart3 className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  No sector data available yet.
                </p>
              </div>
            ) : (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {sectorData.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toFixed(1)}`,
                          'Weight',
                        ]}
                        contentStyle={{
                          borderRadius: '0.75rem',
                          border: '1px solid #e4e4e7',
                          fontSize: '0.75rem',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                  {sectorData.map((d, i) => {
                    const total = sectorData.reduce((s, x) => s + x.value, 0)
                    const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0'
                    return (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              SECTOR_COLORS[i % SECTOR_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-zinc-600">
                          {d.name} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Concentration warning */}
                {concentrationWarning && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      <span className="font-semibold">{concentrationWarning}</span>{' '}
                      makes up over 40% of your allocation. Consider diversifying.
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.section>
        </div>

        {/* ============================================================ */}
        {/*  4. Your Portfolios (horizontal scroll)                      */}
        {/* ============================================================ */}
        <motion.section variants={fadeUp}>
          <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-5">
            Your Portfolios
          </h2>

          {!isLoaded && portfolios.length === 0 ? (
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shrink-0 w-[280px]">
                  <ShimmerCard />
                </div>
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            <div className={`${CARD} p-10 text-center`}>
              <Briefcase className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                No portfolios yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div
              className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-zinc-200"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {portfolios.map((p: Portfolio) => (
                <PortfolioScrollCard key={p.id} portfolio={p} onDelete={(id) => deleteFromServer(id)} />
              ))}

              {/* + New Portfolio */}
              <button
                onClick={() => navigate('/build')}
                className="shrink-0 w-[280px] h-[180px] rounded-[2rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors snap-start"
              >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">New Portfolio</span>
              </button>
            </div>
          )}
        </motion.section>

        {/* ============================================================ */}
        {/*  5 + 6. Market Pulse (60%) + Quick Actions / Profile (40%)   */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8">
          {/* Market Pulse */}
          <motion.section variants={fadeUp} className={`${CARD} p-8`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider">
                    Market Pulse
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {marketData ? `Updated ${new Date(marketData.timestamp * 1000).toLocaleTimeString()}` : 'Loading...'}
                  </p>
                </div>
              </div>
              <button
                onClick={refreshMarket}
                disabled={marketLoading}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${marketLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Indices */}
            {marketLoading && !marketData ? (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-zinc-50 p-4 animate-shimmer">
                    <div className="h-3 w-16 rounded bg-zinc-200 mb-2" />
                    <div className="h-5 w-24 rounded bg-zinc-200" />
                  </div>
                ))}
              </div>
            ) : marketData ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {marketData.indices.map((idx) => (
                    <div key={idx.symbol} className="rounded-2xl bg-zinc-50 p-4">
                      <p className="text-[11px] font-medium text-zinc-400 uppercase">{idx.name}</p>
                      <p className="text-lg font-semibold text-zinc-950 mt-0.5">
                        {idx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${
                        idx.direction === 'up' ? 'text-emerald-600' : idx.direction === 'down' ? 'text-rose-500' : 'text-zinc-400'
                      }`}>
                        {idx.direction === 'up' ? '+' : ''}{idx.changePct.toFixed(2)}%
                        <span className="text-zinc-400 ml-1">
                          ({idx.direction === 'up' ? '+' : ''}{idx.change.toFixed(2)})
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Movers */}
                {(marketData.gainers.length > 0 || marketData.losers.length > 0) && (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {marketData.gainers.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-emerald-600 uppercase mb-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Top Gainers
                        </p>
                        {marketData.gainers.map((m) => (
                          <Link key={m.ticker} to={`/stocks/${m.ticker}`} className="flex items-center justify-between py-1.5 no-underline group">
                            <span className="text-xs font-medium text-zinc-700 group-hover:text-emerald-600">{m.ticker}</span>
                            <span className="text-xs font-semibold text-emerald-600">+{m.changePct.toFixed(1)}%</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {marketData.losers.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-rose-500 uppercase mb-2 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" /> Top Losers
                        </p>
                        {marketData.losers.map((m) => (
                          <Link key={m.ticker} to={`/stocks/${m.ticker}`} className="flex items-center justify-between py-1.5 no-underline group">
                            <span className="text-xs font-medium text-zinc-700 group-hover:text-rose-500">{m.ticker}</span>
                            <span className="text-xs font-semibold text-rose-500">{m.changePct.toFixed(1)}%</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">Market data unavailable</p>
            )}

            {/* AI Chat prompt */}
            <div className="border-t border-zinc-100 pt-4 mt-2">
              <button
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              >
                <Bot className="h-3.5 w-3.5" />
                Ask AI about the market
              </button>
            </div>
          </motion.section>

          {/* Quick Actions + Profile */}
          <motion.section variants={fadeUp} className={`${CARD} p-8`}>
            {/* Quick Actions */}
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-5">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {([
                {
                  label: 'Build Portfolio',
                  href: '/build',
                  icon: Sparkles,
                  color: 'bg-emerald-50 text-emerald-600',
                },
                {
                  label: 'Import Holdings',
                  href: '/analyze/import',
                  icon: Upload,
                  color: 'bg-blue-50 text-blue-600',
                },
                {
                  label: 'Compare Stocks',
                  href: '/compare',
                  icon: BarChart3,
                  color: 'bg-amber-50 text-amber-600',
                },
                {
                  label: 'AI Chat',
                  href: null,
                  icon: MessageCircle,
                  color: 'bg-purple-50 text-purple-600',
                },
              ] as const).map((action) => (
                <QuickActionButton
                  key={action.label}
                  label={action.label}
                  href={action.href}
                  icon={action.icon}
                  color={action.color}
                  onChatOpen={() => setChatOpen(true)}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-100 my-6" />

            {/* Profile */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider">
                Your Profile
              </h2>
              <Link
                to="/preferences"
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Edit
              </Link>
            </div>

            {!isLoaded ? (
              <div className="space-y-3">
                <Shimmer className="h-6 w-24 rounded-full" />
                <Shimmer className="h-4 w-32" />
              </div>
            ) : !preferences.riskTolerance ? (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500">
                  No preferences set.{' '}
                  <Link
                    to="/preferences"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Set up now
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Risk:</span>
                  <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold">
                    {preferences.riskTolerance}
                  </span>
                </div>
                {preferences.investmentHorizon && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Horizon:</span>
                    <span className="text-xs font-medium text-zinc-700">
                      {preferences.investmentHorizon}
                    </span>
                  </div>
                )}
                {preferences.preferredSectors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.preferredSectors.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600"
                      >
                        {s}
                      </span>
                    ))}
                    {preferences.preferredSectors.length > 4 && (
                      <span className="text-[11px] text-zinc-400 self-center">
                        +{preferences.preferredSectors.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </div>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Portfolio scroll card                                              */
/* ------------------------------------------------------------------ */
function PortfolioScrollCard({ portfolio, onDelete }: { portfolio: Portfolio; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const recs = portfolio.recommendations ?? []
  const holdings = portfolio.holdings ?? []
  const count = recs.length + holdings.length
  const isGenerated = portfolio.type === 'generated'
  const detailPath = isGenerated ? `/build/${portfolio.id}` : `/analyze/${portfolio.id}`
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
      className={`${CARD} p-6 shrink-0 w-[280px] h-[180px] text-left flex flex-col justify-between snap-start hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] transition-shadow relative cursor-pointer`}
      onClick={() => navigate(detailPath)}
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-semibold text-zinc-950 truncate flex-1">
            {portfolio.name}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isGenerated
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isGenerated ? 'Generated' : 'Imported'}
          </span>
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((prev) => !prev)
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-20 w-36 rounded-xl bg-white border border-zinc-200 shadow-lg py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    navigate(detailPath)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Eye className="h-4 w-4" /> View
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    if (window.confirm('Delete this portfolio? This cannot be undone.')) {
                      onDelete(portfolio.id)
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          {count} stock{count !== 1 ? 's' : ''}
        </p>
      </div>
      <p className="text-xs text-zinc-400">
        {new Date(portfolio.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Quick action button                                                */
/* ------------------------------------------------------------------ */
function QuickActionButton({
  label,
  href,
  icon: Icon,
  color,
  onChatOpen,
}: {
  label: string
  href: string | null
  icon: React.ComponentType<{ className?: string }>
  color: string
  onChatOpen: () => void
}) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (href) {
      navigate(href)
    } else {
      onChatOpen()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-100 p-4 hover:bg-zinc-50/50 transition-colors group"
    >
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-zinc-700 group-hover:text-zinc-950 transition-colors">
        {label}
      </span>
    </button>
  )
}
