import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Activity,
  Shield,
  TrendingUp,
  Plus,
  Minus,
  X,
  Check,
  Clock,
  Sparkles,
  Square,
} from 'lucide-react'
import { startHealthAnalysis, pollJobStatus, getHealthReport, acceptRebalancing } from '@/services/jobService'

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
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type SuggestionAction = 'Add' | 'Remove' | 'Increase' | 'Decrease'
type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'deferred'

interface RebalanceSuggestion {
  id: string
  action: SuggestionAction
  ticker: string
  targetAllocation: number
  rationale: string
  status: SuggestionStatus
}

/* ------------------------------------------------------------------ */
/*  Analyzing state                                                    */
/* ------------------------------------------------------------------ */
function AnalyzingState({
  statusMessage,
  progress,
  onStop,
}: {
  statusMessage: string
  progress: number
  onStop: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      className={`${CARD} flex flex-col items-center text-center py-16`}
    >
      <div className="relative mb-8">
        <motion.div
          className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Activity className="h-9 w-9 text-emerald-600" />
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-emerald-300"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      <h2 className="text-xl font-semibold text-zinc-950">
        AI is analyzing your portfolio...
      </h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-sm">
        {statusMessage || 'Evaluating diversification, sector concentration, risk profile, and generating rebalancing suggestions.'}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mt-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-400">Progress</span>
          <span className="text-xs font-medium text-emerald-600">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring' as const, stiffness: 50, damping: 15 }}
          />
        </div>
        <p className="text-[11px] text-zinc-400 mt-1.5">
          Typically takes 60-120 seconds
        </p>
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
      >
        <Square className="h-3.5 w-3.5" />
        Stop
      </button>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Circular gauge                                                     */
/* ------------------------------------------------------------------ */
function DiversificationGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 56
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? '#059669' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="140" height="140" className="transform -rotate-90">
          <circle
            cx="70"
            cy="70"
            r="56"
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="10"
          />
          <motion.circle
            cx="70"
            cy="70"
            r="56"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring' as const, stiffness: 60, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-zinc-950">{score}</span>
          <span className="text-xs text-zinc-500">/ 100</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-700">
        Diversification Score
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sector bar chart                                                   */
/* ------------------------------------------------------------------ */
function SectorBars({ sectors }: { sectors: Record<string, number> }) {
  const entries = Object.entries(sectors).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-3">
      {entries.map(([sector, pct]) => (
        <div key={sector}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-600 truncate max-w-[60%]">
              {sector}
            </span>
            <span
              className={`text-xs font-semibold ${
                pct > 30
                  ? 'text-rose-600'
                  : pct > 25
                    ? 'text-amber-600'
                    : 'text-zinc-950'
              }`}
            >
              {pct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                pct > 30
                  ? 'bg-rose-500'
                  : pct > 25
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring' as const, stiffness: 80, damping: 20 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Market cap distribution                                            */
/* ------------------------------------------------------------------ */
function MarketCapBar({
  large,
  mid,
  small,
}: {
  large: number
  mid: number
  small: number
}) {
  return (
    <div>
      <div className="flex h-6 rounded-full overflow-hidden">
        <motion.div
          className="bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${large}%` }}
          transition={{ type: 'spring' as const, stiffness: 80, damping: 20 }}
        />
        <motion.div
          className="bg-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${mid}%` }}
          transition={{ type: 'spring' as const, stiffness: 80, damping: 20, delay: 0.1 }}
        />
        <motion.div
          className="bg-violet-400"
          initial={{ width: 0 }}
          animate={{ width: `${small}%` }}
          transition={{ type: 'spring' as const, stiffness: 80, damping: 20, delay: 0.2 }}
        />
      </div>
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {[
          { label: 'Large Cap', pct: large, color: 'bg-emerald-500' },
          { label: 'Mid Cap', pct: mid, color: 'bg-amber-400' },
          { label: 'Small Cap', pct: small, color: 'bg-violet-400' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span className="text-xs text-zinc-600">{item.label}</span>
            <span className="text-xs font-semibold text-zinc-950">
              {item.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggestion card                                                    */
/* ------------------------------------------------------------------ */
const ACTION_STYLES: Record<
  SuggestionAction,
  { bg: string; text: string; icon: typeof Plus }
> = {
  Add: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Plus },
  Remove: { bg: 'bg-rose-50', text: 'text-rose-700', icon: X },
  Increase: { bg: 'bg-blue-50', text: 'text-blue-700', icon: TrendingUp },
  Decrease: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Minus },
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  onDefer,
}: {
  suggestion: RebalanceSuggestion
  onAccept: () => void
  onDismiss: () => void
  onDefer: () => void
}) {
  const style = ACTION_STYLES[suggestion.action]
  const Icon = style.icon

  return (
    <motion.div
      layout
      variants={fadeUp}
      exit={{ opacity: 0, x: -40, height: 0, marginTop: 0 }}
      className={CARD}
    >
      <div className="flex items-start gap-4">
        <div className={`h-10 w-10 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${style.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
              {suggestion.action}
            </span>
            <Link
              to={`/stocks/${suggestion.ticker}`}
              className="text-sm font-bold text-zinc-950 hover:text-emerald-600 transition-colors"
            >
              {suggestion.ticker}
            </Link>
            {suggestion.targetAllocation > 0 && (
              <span className="text-xs text-zinc-500">
                Target: {suggestion.targetAllocation}%
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-2">{suggestion.rationale}</p>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Check className="h-3 w-3" /> Accept
            </button>
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
            <button
              onClick={onDefer}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Clock className="h-3 w-3" /> Defer
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Accepted suggestion card                                           */
/* ------------------------------------------------------------------ */
function AcceptedCard({ suggestion }: { suggestion: RebalanceSuggestion }) {
  const style = ACTION_STYLES[suggestion.action]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl bg-emerald-50/50 border border-emerald-100 px-4 py-3"
    >
      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      </div>
      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${style.bg} ${style.text}`}>
        {suggestion.action}
      </span>
      <span className="text-sm font-medium text-zinc-950">{suggestion.ticker}</span>
      <span className="text-xs text-zinc-500 ml-auto">Applied</span>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Not found                                                          */
/* ------------------------------------------------------------------ */
function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center">
      <div className="h-20 w-20 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        <Activity className="h-9 w-9 text-zinc-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950">Portfolio not found</h2>
      <p className="text-sm text-zinc-500 mt-2">Cannot generate health report.</p>
      <Link
        to="/analyze"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
      >
        Go to Analyze
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function HealthReportPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const navigate = useNavigate()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const cancelPollRef = useRef<(() => void) | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Local suggestion status overrides (server gives initial status, user can change locally)
  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, SuggestionStatus>>({})

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPollRef.current?.()
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  const startProgress = () => {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += (95 - p) * 0.03
      setProgress(p)
    }, 500)
  }

  const stopProgress = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current)
      progressRef.current = null
    }
  }

  const handleStop = () => {
    cancelPollRef.current?.()
    stopProgress()
    setIsAnalyzing(false)
    setStatusMessage('')
    setProgress(0)
  }

  // Try to load existing report on mount
  useEffect(() => {
    if (!portfolioId) return
    getHealthReport(portfolioId)
      .then((r) => {
        if (r) {
          console.log('Loaded existing health report:', r)
          setReport(r)
        }
      })
      .catch(() => {
        // No report yet — that's fine, user can click Analyze
      })
  }, [portfolioId])

  const handleAnalyze = useCallback(async () => {
    if (!portfolioId) return
    setError(null)
    setIsAnalyzing(true)
    setStatusMessage('Submitting portfolio for analysis...')
    startProgress()

    try {
      const { jobId } = await startHealthAnalysis(portfolioId)

      setStatusMessage('AI is analyzing your portfolio...')

      const cancel = pollJobStatus(jobId, async (job) => {
        if (job.status.startsWith('processing')) {
          const attemptMatch = job.status.match(/attempt (\d+)/)
          const attempt = attemptMatch ? attemptMatch[1] : '1'
          setStatusMessage(`AI is analyzing your portfolio... (attempt ${attempt})`)
        }

        if (job.status === 'completed') {
          setProgress(100)
          stopProgress()
          setStatusMessage('Analysis complete! Loading report...')
          try {
            const healthReport = await getHealthReport(portfolioId!)
            console.log('Health report loaded:', healthReport)
            setReport(healthReport)
            setSuggestionStatuses({})
          } catch (reportErr) {
            console.error('Failed to load health report:', reportErr)
            setError('Analysis completed but failed to load report. Please try again.')
          } finally {
            setIsAnalyzing(false)
          }
        }

        if (job.status === 'failed') {
          stopProgress()
          setError(job.error || 'Portfolio analysis failed. Please try again.')
          setIsAnalyzing(false)
        }
      }, 5000)

      cancelPollRef.current = cancel
    } catch (err) {
      stopProgress()
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to start analysis: ${msg}`)
      setIsAnalyzing(false)
    }
  }, [portfolioId])

  const handleAccept = useCallback(async (suggestion: RebalanceSuggestion) => {
    if (!portfolioId) return
    setSuggestionStatuses((prev) => ({ ...prev, [suggestion.id]: 'accepted' }))
    try {
      await acceptRebalancing(portfolioId, suggestion.id)
    } catch {
      // Revert on failure
      setSuggestionStatuses((prev) => ({ ...prev, [suggestion.id]: 'pending' }))
    }
  }, [portfolioId])

  const handleDismiss = useCallback((id: string) => {
    setSuggestionStatuses((prev) => ({ ...prev, [id]: 'dismissed' }))
  }, [])

  const handleDefer = useCallback((id: string) => {
    setSuggestionStatuses((prev) => ({ ...prev, [id]: 'deferred' }))
  }, [])

  if (!portfolioId) return <NotFound />

  // Derive suggestions with local status overrides
  const suggestions: RebalanceSuggestion[] = (report?.rebalancingSuggestions ?? []).map(
    (s: any) => ({
      ...s,
      status: suggestionStatuses[s.id] ?? s.status ?? 'pending',
    })
  )

  const pending = suggestions.filter((s) => s.status === 'pending')
  const accepted = suggestions.filter((s) => s.status === 'accepted')

  // Extract report data
  const diversificationScore: number = report?.diversificationScore ?? 0
  const sectorAllocation: Record<string, number> = report?.sectorAllocation ?? {}
  const riskProfile: string = report?.riskProfile ?? 'Unknown'
  const marketCap = report?.marketCapDistribution ?? { large: 0, mid: 0, small: 0 }

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
        className="mb-10"
      >
        <button
          onClick={() => navigate(`/analyze/${portfolioId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Portfolio
        </button>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
          Health Report
        </h1>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base">
          Portfolio {portfolioId}
        </p>
      </motion.div>

      {/* Analyzing state */}
      {isAnalyzing && (
        <AnalyzingState statusMessage={statusMessage} progress={progress} onStop={handleStop} />
      )}

      {/* Error state */}
      {!isAnalyzing && error && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={`${CARD} flex flex-col items-center text-center py-12`}
        >
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 mb-6">
            {error}
          </div>
          <button
            onClick={handleAnalyze}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="h-5 w-5" />
            Retry Analysis
          </button>
        </motion.div>
      )}

      {/* Empty state — no report yet */}
      {!isAnalyzing && !error && !report && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className={`${CARD} flex flex-col items-center text-center py-12`}
        >
          <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
            <Activity className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-950">
            Ready to analyze
          </h2>
          <p className="text-sm text-zinc-500 mt-2 max-w-sm">
            Run an AI-powered health check to evaluate diversification, risk profile, and get rebalancing suggestions.
          </p>
          <button
            onClick={handleAnalyze}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
          >
            <Sparkles className="h-5 w-5" />
            Analyze Portfolio
          </button>
        </motion.div>
      )}

      {/* Report content */}
      {!isAnalyzing && report && (
        <>
          {/* Asymmetric 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-start">
            {/* Left column (60%) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
              className="space-y-6"
            >
              {/* Diversification score */}
              <div className={CARD}>
                <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
                  Diversification Score
                </h2>
                <DiversificationGauge score={diversificationScore} />
              </div>

              {/* Sector concentration */}
              {Object.keys(sectorAllocation).length > 0 && (
                <div className={CARD}>
                  <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
                    Sector Concentration
                  </h2>
                  <SectorBars sectors={sectorAllocation} />
                  <p className="text-xs text-zinc-400 mt-4">
                    Sectors above 30% are flagged as concentrated.
                  </p>
                </div>
              )}

              {/* Market cap distribution */}
              {(marketCap.large > 0 || marketCap.mid > 0 || marketCap.small > 0) && (
                <div className={CARD}>
                  <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
                    Market Cap Distribution
                  </h2>
                  <MarketCapBar large={marketCap.large} mid={marketCap.mid} small={marketCap.small} />
                </div>
              )}
            </motion.div>

            {/* Right column (40%) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 260, damping: 24, delay: 0.1 }}
              className="space-y-6 lg:sticky lg:top-8"
            >
              {/* Risk profile */}
              <div className={CARD}>
                <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-4">
                  Detected Risk Profile
                </h2>
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    riskProfile === 'Conservative'
                      ? 'bg-blue-50'
                      : riskProfile === 'Aggressive'
                        ? 'bg-rose-50'
                        : 'bg-amber-50'
                  }`}>
                    <Shield className={`h-6 w-6 ${
                      riskProfile === 'Conservative'
                        ? 'text-blue-600'
                        : riskProfile === 'Aggressive'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-zinc-950">
                      {riskProfile}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Based on sector and cap distribution
                    </p>
                  </div>
                </div>
              </div>

              {/* Re-analyze button */}
              <div className={CARD}>
                <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-4">
                  Actions
                </h2>
                <button
                  onClick={handleAnalyze}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors w-full justify-center"
                >
                  <Activity className="h-4 w-4" /> Re-run Analysis
                </button>
              </div>
            </motion.div>
          </div>

          {/* Full width — Rebalancing suggestions */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 260, damping: 24, delay: 0.2 }}
            className="mt-10"
          >
            <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider mb-6">
              Rebalancing Suggestions
            </h2>

            {pending.length === 0 && accepted.length === 0 && (
              <div className={`${CARD} flex flex-col items-center text-center py-12`}>
                <div className="h-16 w-16 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
                  <Activity className="h-7 w-7 text-zinc-300" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-950">
                  No suggestions available
                </h3>
                <p className="text-sm text-zinc-500 mt-2">
                  Your portfolio appears well-balanced.
                </p>
              </div>
            )}

            {/* Accepted suggestions */}
            {accepted.length > 0 && (
              <div className="mb-6 space-y-2">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Applied ({accepted.length})
                </h3>
                <AnimatePresence>
                  {accepted.map((s) => (
                    <AcceptedCard key={s.id} suggestion={s} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Pending suggestions */}
            {pending.length > 0 && (
              <motion.div
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {pending.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onAccept={() => handleAccept(s)}
                      onDismiss={() => handleDismiss(s.id)}
                      onDefer={() => handleDefer(s.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
