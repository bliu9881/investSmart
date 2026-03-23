import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Activity,
  BarChart3,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  Trash2,
} from 'lucide-react'
import { usePortfolioStore, type Holding } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { getPortfolio, deletePortfolio } from '@/services/portfolioService'
import { getStockPrices, type StockPrice } from '@/services/marketService'

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
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({})
  const [newTicker, setNewTicker] = useState('')
  const [newQty, setNewQty] = useState('')
  const fetchRef = useRef(0)

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

  // Fetch live prices
  useEffect(() => {
    const tickers = holdings.map((h) => h.ticker).filter(Boolean)
    if (tickers.length === 0) return
    const id = ++fetchRef.current
    const timer = setTimeout(async () => {
      const prices = await getStockPrices(tickers)
      if (fetchRef.current === id) setStockPrices(prices)
    }, 300)
    return () => clearTimeout(timer)
  }, [holdings])

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

  const handleAddHolding = useCallback(() => {
    const ticker = newTicker.trim().toUpperCase()
    const qty = parseFloat(newQty)
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) return
    if (!qty || qty <= 0) return
    if (holdings.find((h) => h.ticker === ticker)) return
    if (!portfolio) return

    const newHolding: Holding = {
      id: `manual-${Date.now()}`,
      ticker,
      quantity: qty,
      companyName: stockPrices[ticker]?.name || '',
      sector: stockPrices[ticker]?.sector || '',
      currentPrice: stockPrices[ticker]?.price || 0,
    }
    const updated = { ...portfolio, holdings: [...holdings, newHolding] }
    addPortfolio(updated)
    setNewTicker('')
    setNewQty('')
  }, [newTicker, newQty, holdings, portfolio, addPortfolio, stockPrices])

  const handleRemoveHolding = useCallback((holdingId: string) => {
    if (!portfolio) return
    const updated = { ...portfolio, holdings: holdings.filter((h) => h.id !== holdingId) }
    addPortfolio(updated)
  }, [portfolio, holdings, addPortfolio])

  const handleDeletePortfolio = useCallback(async () => {
    if (!portfolioId) return
    if (!window.confirm('Delete this portfolio? This cannot be undone.')) return
    try {
      await deletePortfolio(portfolioId)
      navigate('/')
    } catch {
      alert('Failed to delete portfolio')
    }
  }, [portfolioId, navigate])

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
              onClick={handleDeletePortfolio}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
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
        <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-4">
          Holdings
        </h2>

        {/* Add stock input */}
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="Ticker (e.g. AAPL)"
            className="w-36 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
          <input
            type="number"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            placeholder="Shares"
            min="1"
            className="w-24 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
          <button
            onClick={handleAddHolding}
            disabled={!newTicker.trim() || !newQty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

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
                  const livePrice = stockPrices[h.ticker]
                  const currentPrice = livePrice?.price ?? h.currentPrice ?? 0
                  const cost = (h.costBasis ?? 0) * h.quantity
                  const value = currentPrice * h.quantity
                  const gl = value - cost
                  const hasPrices = (h.costBasis ?? 0) > 0 && currentPrice > 0
                  const companyName = livePrice?.name || h.companyName || '--'

                  return (
                    <motion.tr
                      key={h.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors group"
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
                        {companyName}
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
                        {currentPrice > 0 ? (
                          <div>
                            <span className="font-medium text-zinc-950">${currentPrice.toFixed(2)}</span>
                            {livePrice && (
                              <span className={`ml-2 text-xs font-medium ${
                                livePrice.changePct >= 0 ? 'text-emerald-600' : 'text-rose-500'
                              }`}>
                                {livePrice.changePct >= 0 ? '+' : ''}{livePrice.changePct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ) : '--'}
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
                      <td className="px-4 py-4 flex items-center gap-2">
                        <Link
                          to={`/stocks/${h.ticker}`}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Analyze
                        </Link>
                        <button
                          onClick={() => handleRemoveHolding(h.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          title="Remove holding"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
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
