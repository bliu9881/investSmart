import { useMemo, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Activity,
  BarChart3,
  Briefcase,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { getPortfolio } from '@/services/portfolioService'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CARD =
  'bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

/* ------------------------------------------------------------------ */
/*  Skeleton loading                                                   */
/* ------------------------------------------------------------------ */
function NotFound() {
  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto flex flex-col items-center justify-center">
      <div className="h-20 w-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        <Briefcase className="h-9 w-9 text-zinc-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950">
        Portfolio not found
      </h2>
      <p className="text-sm text-zinc-500 mt-2">
        This portfolio may have been removed or doesn&rsquo;t exist.
      </p>
      <Link
        to="/analyze"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
      >
        Import Portfolio
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ImportedPortfolioPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const navigate = useNavigate()
  const { portfolios, setActivePortfolio, addPortfolio } = usePortfolioStore()
  const { addComparisonTicker, clearComparisonTickers } = useUIStore()
  const [loading, setLoading] = useState(false)

  const portfolio = useMemo(
    () => portfolios.find((p) => p.id === portfolioId) ?? null,
    [portfolios, portfolioId]
  )

  // Fetch from server if not in local store
  useEffect(() => {
    if (!portfolio && portfolioId) {
      setLoading(true)
      getPortfolio(portfolioId)
        .then((p) => {
          const resolved = { ...p, id: p.id || (p as any).portfolioId || portfolioId }
          setActivePortfolio(resolved)
          addPortfolio(resolved)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [portfolioId]) // eslint-disable-line react-hooks/exhaustive-deps

  const holdings = portfolio?.holdings ?? []

  const totalCost = useMemo(
    () =>
      holdings.reduce(
        (s, h) => s + (h.costBasis ?? 0) * h.quantity,
        0
      ),
    [holdings]
  )

  const totalValue = useMemo(
    () =>
      holdings.reduce(
        (s, h) => s + (h.currentPrice ?? 0) * h.quantity,
        0
      ),
    [holdings]
  )

  const totalGainLoss = totalValue - totalCost

  const handleCompare = () => {
    clearComparisonTickers()
    holdings.slice(0, 5).forEach((h) => addComparisonTicker(h.ticker))
    navigate('/compare')
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  if (!portfolio) return <NotFound />

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
          onClick={() => navigate('/analyze')}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Analyze
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
              {portfolio.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-sm text-zinc-500">
                {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
              </span>
              {totalCost > 0 && (
                <span className="text-sm text-zinc-500">
                  Cost: ${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              )}
              {totalValue > 0 && (
                <span className="text-sm font-semibold text-zinc-950">
                  Value: ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCompare}
              disabled={holdings.length < 2}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              <BarChart3 className="h-4 w-4" /> Compare Holdings
            </button>
            <Link
              to={`/analyze/${portfolioId}/health`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Activity className="h-4 w-4" /> Analyze Portfolio
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Summary stats */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
      >
        {[
          {
            label: 'Holdings',
            value: holdings.length.toString(),
          },
          {
            label: 'Total Cost',
            value: totalCost > 0 ? `$${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--',
          },
          {
            label: 'Current Value',
            value: totalValue > 0 ? `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--',
          },
          {
            label: 'Gain / Loss',
            value:
              totalCost > 0 && totalValue > 0
                ? `${totalGainLoss >= 0 ? '+' : ''}$${totalGainLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '--',
            color:
              totalGainLoss >= 0
                ? 'text-emerald-600'
                : 'text-rose-600',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white border border-zinc-200/50 shadow-sm p-5">
            <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-semibold ${('color' in stat && stat.color) ? stat.color : 'text-zinc-950'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Holdings table */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
        className={CARD}
      >
        <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
          Holdings
        </h2>

        {holdings.length === 0 && (
          <div className="flex flex-col items-center text-center py-10">
            <div className="h-14 w-14 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-zinc-300" />
            </div>
            <p className="text-sm text-zinc-500">No holdings in this portfolio.</p>
          </div>
        )}

        {holdings.length > 0 && (
          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  {['Ticker', 'Company', 'Shares', 'Cost Basis', 'Current Price', 'Gain/Loss'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    )
                  )}
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const cost = (h.costBasis ?? 0) * h.quantity
                  const value = (h.currentPrice ?? 0) * h.quantity
                  const gl = value - cost
                  const hasPrices = (h.costBasis ?? 0) > 0 && (h.currentPrice ?? 0) > 0

                  return (
                    <motion.tr
                      key={h.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <Link
                          to={`/stocks/${h.ticker}`}
                          className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white tracking-wide hover:bg-emerald-700 transition-colors"
                        >
                          {h.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {h.companyName ?? '--'}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-zinc-950">
                        {h.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {h.costBasis
                          ? `$${h.costBasis.toFixed(2)}`
                          : '--'}
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-700">
                        {h.currentPrice
                          ? `$${h.currentPrice.toFixed(2)}`
                          : '--'}
                      </td>
                      <td className="px-4 py-4">
                        {hasPrices ? (
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              gl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {gl >= 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {gl >= 0 ? '+' : ''}${gl.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          to={`/stocks/${h.ticker}`}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Analyze
                        </Link>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
