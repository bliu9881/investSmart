import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowRight,
  Settings,
  Layers,
  TrendingUp,
  Shield,
  Square,
} from 'lucide-react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { startPortfolioGeneration, pollJobStatus } from '@/services/jobService'
import { getPortfolio } from '@/services/portfolioService'

/* ------------------------------------------------------------------ */
/*  Card style constants                                               */
/* ------------------------------------------------------------------ */
const CARD =
  'bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8'

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

/* ------------------------------------------------------------------ */
/*  Loading animation                                                  */
/* ------------------------------------------------------------------ */
function GeneratingState({
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
          <Sparkles className="h-9 w-9 text-emerald-600" />
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-emerald-300"
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      <h2 className="text-xl font-semibold text-zinc-950">
        AI is building your portfolio...
      </h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-sm">
        {statusMessage || 'Analyzing market data, evaluating fundamentals, and optimizing allocations based on your preferences.'}
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
/*  Preferences missing prompt                                         */
/* ------------------------------------------------------------------ */
function SetPreferencesPrompt() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={`${CARD} flex flex-col items-center text-center py-12`}
    >
      <div className="h-16 w-16 rounded-full bg-zinc-50 flex items-center justify-center mb-6">
        <Settings className="h-7 w-7 text-zinc-400" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950">
        Set your preferences first
      </h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-sm">
        Before generating a portfolio, we need to know your risk tolerance,
        preferred sectors, and investment horizon.
      </p>
      <Link
        to="/onboarding"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
      >
        Set Preferences <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function BuildPage() {
  const navigate = useNavigate()
  const { preferences } = usePreferencesStore()
  const { isGenerating, setGenerating, addPortfolio } = usePortfolioStore()
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const cancelPollRef = useRef<(() => void) | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasPreferences = preferences.riskTolerance !== null

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPollRef.current?.()
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  const startProgress = () => {
    setProgress(0)
    // Simulate progress: fast at start, slows down, never reaches 100
    let p = 0
    progressRef.current = setInterval(() => {
      p += (95 - p) * 0.03 // asymptotic approach to 95%
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
    setGenerating(false)
    setStatusMessage('')
    setProgress(0)
  }

  const handleGenerate = useCallback(async () => {
    setError(null)
    setGenerating(true)
    setStatusMessage('Submitting to AI agent...')
    startProgress()

    try {
      // 1. Start async generation — returns immediately with jobId
      const { jobId } = await startPortfolioGeneration({
        riskTolerance: preferences.riskTolerance!,
        investmentHorizon: preferences.investmentHorizon!,
        preferredSectors: preferences.preferredSectors,
        favoriteStocks: preferences.favoriteStocks,
      })

      setStatusMessage('AI is researching stocks and building your portfolio...')

      // 2. Poll for completion
      const cancel = pollJobStatus(jobId, async (job) => {
        if (job.status.startsWith('processing')) {
          const attemptMatch = job.status.match(/attempt (\d+)/)
          const attempt = attemptMatch ? attemptMatch[1] : '1'
          setStatusMessage(`AI is researching stocks and building your portfolio... (attempt ${attempt})`)
        }

        if (job.status === 'completed' && job.portfolioId) {
          setProgress(100)
          stopProgress()
          setStatusMessage('Portfolio ready! Loading...')
          try {
            const portfolio = await getPortfolio(job.portfolioId)
            addPortfolio({ ...portfolio, id: job.portfolioId })
            setGenerating(false)
            navigate(`/build/${job.portfolioId}`)
          } catch {
            setError('Portfolio was generated but failed to load. Check your dashboard.')
            setGenerating(false)
          }
        }

        if (job.status === 'failed') {
          stopProgress()
          setError(job.error || 'Portfolio generation failed. Please try again.')
          setGenerating(false)
        }
      }, 5000)

      cancelPollRef.current = cancel
    } catch (err) {
      stopProgress()
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to start portfolio generation: ${msg}`)
      setGenerating(false)
    }
  }, [preferences, setGenerating, addPortfolio, navigate])

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
          Build New Portfolio
        </h1>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-[65ch]">
          Generate a personalized portfolio based on your investment preferences.
        </p>
      </motion.div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-start">
        {/* Left column */}
        <div className="space-y-6">
          {!hasPreferences && <SetPreferencesPrompt />}

          {hasPreferences && isGenerating && <GeneratingState statusMessage={statusMessage} progress={progress} onStop={handleStop} />}

          {hasPreferences && !isGenerating && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className={`${CARD} flex flex-col items-center text-center py-12`}
            >
              <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
                <Sparkles className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-950">
                Ready to generate
              </h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-sm">
                We&rsquo;ll use your preferences to build a diversified portfolio
                tailored to your goals.
              </p>

              {error && (
                <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
              >
                <Sparkles className="h-5 w-5" />
                Generate Portfolio
              </button>
            </motion.div>
          )}
        </div>

        {/* Right column — preferences summary */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
          className={`${CARD} space-y-6 lg:sticky lg:top-8`}
        >
          <h2 className="text-sm font-semibold text-zinc-950 uppercase tracking-wider">
            Your Preferences
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center">
                <Shield className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Risk Tolerance</p>
                <p className="text-sm font-semibold text-zinc-950">
                  {preferences.riskTolerance ?? 'Not set'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Investment Horizon</p>
                <p className="text-sm font-semibold text-zinc-950">
                  {preferences.investmentHorizon ?? 'Not set'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center">
                <Layers className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Preferred Sectors</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {preferences.preferredSectors.length > 0 ? (
                    preferences.preferredSectors.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-medium text-zinc-600 bg-zinc-100 rounded-full px-2 py-0.5"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-400">None selected</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasPreferences && (
            <Link
              to="/preferences"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Edit Preferences <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  )
}
