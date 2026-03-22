import { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  Upload,
  ArrowRight,
  Briefcase,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { usePortfolioStore, type Portfolio } from '@/stores/portfolioStore'

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

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

/* ------------------------------------------------------------------ */
/*  Imported portfolio summary card                                    */
/* ------------------------------------------------------------------ */
function ImportedSummaryCard({ portfolio }: { portfolio: Portfolio }) {
  const holdings = portfolio.holdings ?? []
  const totalValue = holdings.reduce(
    (s, h) => s + (h.currentPrice ?? 0) * h.quantity,
    0
  )
  const sectors = new Set(holdings.map((h) => h.sector).filter(Boolean))

  return (
    <motion.div variants={fadeUp}>
      <Link
        to={`/analyze/${portfolio.id}`}
        className={`${CARD} block hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] transition-shadow group`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-zinc-950 truncate">
              {portfolio.name}
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
              {totalValue > 0 && (
                <>
                  {' '}
                  &middot; $
                  {totalValue.toLocaleString('en-US', {
                    maximumFractionDigits: 0,
                  })}
                </>
              )}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-emerald-600 transition-colors shrink-0 mt-1" />
        </div>

        <div className="flex gap-1.5 mt-4 flex-wrap">
          {Array.from(sectors)
            .slice(0, 4)
            .map((s) => (
              <span
                key={s}
                className="text-[10px] font-medium text-zinc-500 bg-zinc-50 rounded-full px-2 py-0.5"
              >
                {s}
              </span>
            ))}
          {sectors.size > 4 && (
            <span className="text-[10px] font-medium text-zinc-400">
              +{sectors.size - 4}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Activity className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-600">
            View Health Report
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AnalyzePage() {
  const navigate = useNavigate()
  const { portfolios } = usePortfolioStore()

  const imported = useMemo(
    () => portfolios.filter((p) => p.type === 'imported'),
    [portfolios]
  )

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
          Analyze Existing Portfolio
        </h1>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-[65ch]">
          Import your holdings to get a comprehensive health analysis with
          rebalancing suggestions.
        </p>
      </motion.div>

      {/* Import options — split layout */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
      >
        {/* Manual entry card */}
        <motion.div variants={fadeUp} className={CARD}>
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
            <FileText className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-950">
            Enter Holdings
          </h2>
          <p className="text-sm text-zinc-500 mt-2 mb-6">
            Manually add your stock positions one by one. Great for small
            portfolios or quick checks.
          </p>
          <button
            onClick={() => navigate('/analyze/import?mode=manual')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Enter Manually <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>

        {/* CSV upload card */}
        <motion.div variants={fadeUp} className={CARD}>
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
            <Upload className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-950">Upload CSV</h2>
          <p className="text-sm text-zinc-500 mt-2 mb-6">
            Drag and drop a CSV file exported from your broker. We&rsquo;ll
            parse and validate all holdings automatically.
          </p>
          <button
            onClick={() => navigate('/analyze/import?mode=csv')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Upload CSV <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>

      {/* Previously imported portfolios */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-5">
          Imported Portfolios
        </h2>

        {imported.length === 0 && (
          <div className={`${CARD} flex flex-col items-center text-center py-12`}>
            <div className="h-16 w-16 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
              <Briefcase className="h-7 w-7 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-950">
              No portfolios imported yet
            </h3>
            <p className="text-sm text-zinc-500 mt-2 max-w-sm">
              Import your first portfolio above to get started with health
              analysis.
            </p>
          </div>
        )}

        {imported.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {imported.map((p) => (
              <ImportedSummaryCard key={p.id} portfolio={p} />
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
