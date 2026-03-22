import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  X,
  Plus,
  BarChart3,
  AlertCircle,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CARD =
  'bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8'

const TICKER_REGEX = /^[A-Z]{1,5}$/

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

/* ------------------------------------------------------------------ */
/*  TODO: Replace with real API data                                   */
/* ------------------------------------------------------------------ */
interface StockMetrics {
  ticker: string
  companyName: string
  currentPrice: number
  high52: number
  low52: number
  peRatio: number | null
  dividendYield: number | null
  marketCap: string
  sector: string
  compositeScore: number
}

const MOCK_DATA: Record<string, StockMetrics> = {
  AAPL: { ticker: 'AAPL', companyName: 'Apple Inc.', currentPrice: 198.11, high52: 220.2, low52: 155.0, peRatio: 31.2, dividendYield: 0.52, marketCap: '$3.05T', sector: 'Technology', compositeScore: 82 },
  MSFT: { ticker: 'MSFT', companyName: 'Microsoft Corp.', currentPrice: 425.52, high52: 450.16, low52: 362.9, peRatio: 36.8, dividendYield: 0.71, marketCap: '$3.16T', sector: 'Technology', compositeScore: 85 },
  GOOGL: { ticker: 'GOOGL', companyName: 'Alphabet Inc.', currentPrice: 178.36, high52: 193.31, low52: 130.67, peRatio: 25.4, dividendYield: null, marketCap: '$2.18T', sector: 'Communication Services', compositeScore: 79 },
  AMZN: { ticker: 'AMZN', companyName: 'Amazon.com Inc.', currentPrice: 186.49, high52: 201.2, low52: 145.86, peRatio: 62.1, dividendYield: null, marketCap: '$1.94T', sector: 'Consumer Discretionary', compositeScore: 77 },
  NVDA: { ticker: 'NVDA', companyName: 'NVIDIA Corp.', currentPrice: 875.28, high52: 974.0, low52: 394.36, peRatio: 65.3, dividendYield: 0.02, marketCap: '$2.15T', sector: 'Technology', compositeScore: 88 },
  TSLA: { ticker: 'TSLA', companyName: 'Tesla Inc.', currentPrice: 177.48, high52: 278.98, low52: 152.37, peRatio: 42.5, dividendYield: null, marketCap: '$565B', sector: 'Consumer Discretionary', compositeScore: 58 },
  JPM: { ticker: 'JPM', companyName: 'JPMorgan Chase', currentPrice: 196.7, high52: 210.08, low52: 163.63, peRatio: 11.8, dividendYield: 2.15, marketCap: '$570B', sector: 'Financials', compositeScore: 78 },
  JNJ: { ticker: 'JNJ', companyName: 'Johnson & Johnson', currentPrice: 157.87, high52: 168.85, low52: 143.13, peRatio: 10.2, dividendYield: 3.05, marketCap: '$380B', sector: 'Healthcare', compositeScore: 74 },
  V: { ticker: 'V', companyName: 'Visa Inc.', currentPrice: 280.15, high52: 295.86, low52: 252.7, peRatio: 30.5, dividendYield: 0.76, marketCap: '$573B', sector: 'Financials', compositeScore: 79 },
  META: { ticker: 'META', companyName: 'Meta Platforms', currentPrice: 505.65, high52: 542.81, low52: 390.42, peRatio: 25.8, dividendYield: 0.4, marketCap: '$1.28T', sector: 'Communication Services', compositeScore: 80 },
}

type MetricKey = 'currentPrice' | 'high52' | 'low52' | 'peRatio' | 'dividendYield' | 'marketCap' | 'sector' | 'compositeScore'

interface MetricDef {
  key: MetricKey
  label: string
  format: (v: StockMetrics) => string
  bestFn?: (values: (number | null)[]) => number | null
}

const METRICS: MetricDef[] = [
  {
    key: 'currentPrice',
    label: 'Current Price',
    format: (v) => `$${v.currentPrice.toFixed(2)}`,
  },
  {
    key: 'high52',
    label: '52-Week High',
    format: (v) => `$${v.high52.toFixed(2)}`,
    bestFn: (vals) => vals.reduce<number | null>((best, v) => (v !== null && (best === null || v > best) ? v : best), null),
  },
  {
    key: 'low52',
    label: '52-Week Low',
    format: (v) => `$${v.low52.toFixed(2)}`,
    bestFn: (vals) => vals.reduce<number | null>((best, v) => (v !== null && (best === null || v < best) ? v : best), null),
  },
  {
    key: 'peRatio',
    label: 'P/E Ratio',
    format: (v) => (v.peRatio !== null ? v.peRatio.toFixed(1) : 'N/A'),
    bestFn: (vals) => {
      const valid = vals.filter((v): v is number => v !== null)
      return valid.length > 0 ? Math.min(...valid) : null
    },
  },
  {
    key: 'dividendYield',
    label: 'Dividend Yield',
    format: (v) => (v.dividendYield !== null ? `${v.dividendYield.toFixed(2)}%` : 'N/A'),
    bestFn: (vals) => {
      const valid = vals.filter((v): v is number => v !== null)
      return valid.length > 0 ? Math.max(...valid) : null
    },
  },
  { key: 'marketCap', label: 'Market Cap', format: (v) => v.marketCap },
  { key: 'sector', label: 'Sector', format: (v) => v.sector },
  {
    key: 'compositeScore',
    label: 'Composite Score',
    format: (v) => v.compositeScore.toString(),
    bestFn: (vals) => {
      const valid = vals.filter((v): v is number => v !== null)
      return valid.length > 0 ? Math.max(...valid) : null
    },
  },
]

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState() {
  return (
    <div className={`${CARD} flex flex-col items-center text-center py-16`}>
      <div className="h-20 w-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        <BarChart3 className="h-9 w-9 text-zinc-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950">
        Select 2&ndash;5 stocks to compare
      </h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-sm">
        Enter ticker symbols above to compare stocks side by side across
        all key metrics.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ComparePage() {
  const {
    comparisonTickers,
    addComparisonTicker,
    removeComparisonTicker,
  } = useUIStore()

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stocks = useMemo(
    () =>
      comparisonTickers
        .map((t) => MOCK_DATA[t])
        .filter((s): s is StockMetrics => s !== undefined),
    [comparisonTickers]
  )

  const handleAdd = useCallback(() => {
    const ticker = input.trim().toUpperCase()
    setError(null)

    if (!TICKER_REGEX.test(ticker)) {
      setError('Enter a valid ticker (1-5 uppercase letters).')
      return
    }

    if (comparisonTickers.length >= 5) {
      setError('Maximum 5 stocks allowed for comparison.')
      return
    }

    if (comparisonTickers.includes(ticker)) {
      setError(`${ticker} is already added.`)
      return
    }

    if (!MOCK_DATA[ticker]) {
      // TODO: Replace with API lookup
      setError(`No data available for ${ticker}. Try AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, JPM, JNJ, V, or META.`)
      return
    }

    addComparisonTicker(ticker)
    setInput('')
  }, [input, comparisonTickers, addComparisonTicker])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  // Determine "best" value per metric
  const bestValues = useMemo(() => {
    const result: Record<string, number | null> = {}
    for (const metric of METRICS) {
      if (!metric.bestFn) continue
      const values = stocks.map((s) => {
        const v = s[metric.key]
        return typeof v === 'number' ? v : null
      })
      result[metric.key] = metric.bestFn(values)
    }
    return result
  }, [stocks])

  const isBest = (metric: MetricDef, stock: StockMetrics): boolean => {
    if (!metric.bestFn) return false
    const val = stock[metric.key]
    if (typeof val !== 'number') return false
    return val === bestValues[metric.key]
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
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
          Compare Stocks
        </h1>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-[65ch]">
          Compare multiple stocks side by side across all analysis dimensions.
        </p>
      </motion.div>

      {/* Ticker selector */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className={`${CARD} mb-8`}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value.toUpperCase().slice(0, 5))
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter ticker symbol (e.g., AAPL)"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={comparisonTickers.length >= 5}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Selected tickers as chips */}
        {comparisonTickers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <AnimatePresence>
              {comparisonTickers.map((t) => (
                <motion.span
                  key={t}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700"
                >
                  {t}
                  <button
                    onClick={() => removeComparisonTicker(t)}
                    className="h-4 w-4 rounded-full hover:bg-emerald-100 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            <span className="text-xs text-zinc-400 self-center">
              {comparisonTickers.length}/5 stocks
            </span>
          </div>
        )}
      </motion.div>

      {/* Comparison table or empty state */}
      {stocks.length < 2 ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <EmptyState />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className={CARD}
        >
          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[140px]">
                    Metric
                  </th>
                  {stocks.map((s) => (
                    <th
                      key={s.ticker}
                      className="px-4 py-4 text-center min-w-[130px]"
                    >
                      <Link
                        to={`/stocks/${s.ticker}`}
                        className="inline-flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                      >
                        <span className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white tracking-wide">
                          {s.ticker}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-normal">
                          {s.companyName}
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric, idx) => (
                  <tr
                    key={metric.key}
                    className={
                      idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'
                    }
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-zinc-700 sticky left-0 bg-inherit z-10">
                      {metric.label}
                    </td>
                    {stocks.map((stock) => {
                      const best = isBest(metric, stock)
                      return (
                        <td
                          key={stock.ticker}
                          className={`px-4 py-3.5 text-sm text-center font-medium ${
                            best
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'text-zinc-950'
                          }`}
                        >
                          {metric.format(stock)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
