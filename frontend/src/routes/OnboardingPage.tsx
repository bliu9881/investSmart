import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Target,
  TrendingUp,
  Clock,
  ArrowRight,
  Check,
  Plus,
} from 'lucide-react'
import { usePreferencesStore } from '@/stores/preferencesStore'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const RISK_OPTIONS = [
  {
    value: 'Conservative' as const,
    icon: Shield,
    title: 'Conservative',
    description: 'Lower risk, steady returns. Capital preservation is the priority.',
  },
  {
    value: 'Moderate' as const,
    icon: Target,
    title: 'Moderate',
    description: 'Balanced risk and reward. A mix of growth and stability.',
  },
  {
    value: 'Aggressive' as const,
    icon: TrendingUp,
    title: 'Aggressive',
    description: 'Higher risk, growth focused. Maximize long-term returns.',
  },
]

const HORIZON_OPTIONS = [
  {
    value: 'Short-term' as const,
    label: 'Short-term',
    sub: '< 1 year',
    description: 'Quick gains, high liquidity needs.',
  },
  {
    value: 'Medium-term' as const,
    label: 'Medium-term',
    sub: '1 - 5 years',
    description: 'Moderate growth over a few years.',
  },
  {
    value: 'Long-term' as const,
    label: 'Long-term',
    sub: '5+ years',
    description: 'Patient wealth building over time.',
  },
]

const SECTORS = [
  'Technology',
  'Healthcare',
  'Finance',
  'Energy',
  'Consumer Staples',
  'Consumer Discretionary',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
]

const TOTAL_STEPS = 4

/* ------------------------------------------------------------------ */
/*  Ticker validation (client-side format check)                       */
/* ------------------------------------------------------------------ */
function isValidTicker(value: string): boolean {
  return /^[A-Z]{1,5}$/.test(value.toUpperCase().trim())
}

/* ------------------------------------------------------------------ */
/*  Slide direction variants                                           */
/* ------------------------------------------------------------------ */
function getSlideVariants(direction: 1 | -1) {
  return {
    enter: { x: direction * 80, opacity: 0 },
    center: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { x: direction * -80, opacity: 0, transition: { duration: 0.2 } },
  }
}

/* ------------------------------------------------------------------ */
/*  Progress bar                                                       */
/* ------------------------------------------------------------------ */
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full bg-zinc-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={false}
            animate={{ width: i < current ? '100%' : i === current ? '50%' : '0%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 1 – Risk Tolerance                                            */
/* ------------------------------------------------------------------ */
function StepRisk({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: 'Conservative' | 'Moderate' | 'Aggressive') => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
          What&rsquo;s your risk tolerance?
        </h2>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-lg">
          This helps us calibrate the types of stocks and allocation strategy for your portfolio.
        </p>
      </div>

      <div className="grid gap-4">
        {RISK_OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <motion.button
              key={opt.value}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onChange(opt.value)}
              className={`relative rounded-2xl border-2 p-6 text-left transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-50/60'
                  : 'border-zinc-200/70 bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    selected ? 'bg-emerald-100' : 'bg-zinc-50'
                  }`}
                >
                  <opt.icon
                    className={`h-5 w-5 ${selected ? 'text-emerald-600' : 'text-zinc-400'}`}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-zinc-950">{opt.title}</h3>
                  <p className="text-sm text-zinc-500 mt-0.5">{opt.description}</p>
                </div>
                {selected && (
                  <div className="ml-auto shrink-0 h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 2 – Investment Horizon                                        */
/* ------------------------------------------------------------------ */
function StepHorizon({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: 'Short-term' | 'Medium-term' | 'Long-term') => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
          What&rsquo;s your investment horizon?
        </h2>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-lg">
          Longer horizons typically allow for more growth-oriented strategies.
        </p>
      </div>

      <div className="grid gap-4">
        {HORIZON_OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <motion.button
              key={opt.value}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onChange(opt.value)}
              className={`relative rounded-2xl border-2 p-6 text-left transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-50/60'
                  : 'border-zinc-200/70 bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    selected ? 'bg-emerald-100' : 'bg-zinc-50'
                  }`}
                >
                  <Clock
                    className={`h-5 w-5 ${selected ? 'text-emerald-600' : 'text-zinc-400'}`}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-zinc-950">
                    {opt.label}{' '}
                    <span className="font-normal text-zinc-400">({opt.sub})</span>
                  </h3>
                  <p className="text-sm text-zinc-500 mt-0.5">{opt.description}</p>
                </div>
                {selected && (
                  <div className="ml-auto shrink-0 h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 3 – Preferred Sectors                                         */
/* ------------------------------------------------------------------ */
function StepSectors({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (sectors: string[]) => void
}) {
  const toggle = (sector: string) => {
    if (selected.includes(sector)) {
      onChange(selected.filter((s) => s !== sector))
    } else {
      onChange([...selected, sector])
    }
  }

  const selectAll = () => onChange([...SECTORS])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
          Which sectors interest you?
        </h2>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-lg">
          Select the market sectors you&rsquo;d like your portfolio to focus on, or skip to include
          all.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {SECTORS.map((sector) => {
          const active = selected.includes(sector)
          return (
            <motion.button
              key={sector}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggle(sector)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {sector}
            </motion.button>
          )
        })}
      </div>

      <button
        onClick={selectAll}
        className="text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
      >
        Skip &mdash; include all sectors
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 4 – Favorite Stocks                                           */
/* ------------------------------------------------------------------ */
function StepStocks({
  tickers,
  onChange,
}: {
  tickers: string[]
  onChange: (tickers: string[]) => void
}) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addTicker = useCallback(() => {
    const raw = input.toUpperCase().trim()
    if (!raw) return
    if (!isValidTicker(raw)) {
      setError('Enter a valid ticker (1-5 letters, e.g. AAPL)')
      return
    }
    if (tickers.includes(raw)) {
      setError(`${raw} is already added`)
      return
    }
    setError(null)
    onChange([...tickers, raw])
    setInput('')
  }, [input, tickers, onChange])

  const removeTicker = (t: string) => onChange(tickers.filter((x) => x !== t))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
          Any favorite stocks?
        </h2>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-lg">
          Add tickers you&rsquo;d like us to consider including. This is optional.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase())
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTicker()
            }
          }}
          placeholder="e.g. AAPL"
          className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-shadow"
          maxLength={5}
        />
        <button
          onClick={addTicker}
          className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {tickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tickers.map((t) => (
            <motion.span
              key={t}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700"
            >
              {t}
              <button
                onClick={() => removeTicker(t)}
                className="ml-0.5 h-4 w-4 rounded-full bg-emerald-200/60 text-emerald-700 hover:bg-emerald-300/60 flex items-center justify-center text-xs leading-none transition-colors"
                aria-label={`Remove ${t}`}
              >
                &times;
              </button>
            </motion.span>
          ))}
        </div>
      )}

      {tickers.length === 0 && (
        <p className="text-sm text-zinc-400">No tickers added yet. You can skip this step.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Summary card                                                       */
/* ------------------------------------------------------------------ */
function Summary({
  risk,
  horizon,
  sectors,
  tickers,
}: {
  risk: string | null
  horizon: string | null
  sectors: string[]
  tickers: string[]
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Risk Tolerance', value: risk ?? 'Not set' },
    { label: 'Investment Horizon', value: horizon ?? 'Not set' },
    {
      label: 'Sectors',
      value: sectors.length === SECTORS.length ? 'All sectors' : sectors.join(', ') || 'None',
    },
    { label: 'Favorite Stocks', value: tickers.join(', ') || 'None' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
          You&rsquo;re all set
        </h2>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-lg">
          Here&rsquo;s a summary of your preferences. You can always update these later.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8 space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium text-zinc-500 shrink-0">{row.label}</span>
            <span className="text-sm font-semibold text-zinc-950 text-right">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main onboarding page                                               */
/* ------------------------------------------------------------------ */
export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setPreferences, setLoaded } = usePreferencesStore()

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)

  // Local draft state
  const [risk, setRisk] = useState<'Conservative' | 'Moderate' | 'Aggressive' | null>(null)
  const [horizon, setHorizon] = useState<'Short-term' | 'Medium-term' | 'Long-term' | null>(null)
  const [sectors, setSectors] = useState<string[]>([])
  const [tickers, setTickers] = useState<string[]>([])

  const showSummary = step === TOTAL_STEPS

  const canNext =
    step === 0
      ? risk !== null
      : step === 1
        ? horizon !== null
        : step === 2
          ? sectors.length > 0
          : true // step 3 (stocks) is optional

  const goNext = () => {
    if (step === 2 && sectors.length === 0) {
      setSectors([...SECTORS])
    }
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const goBack = () => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleFinish = async () => {
    const prefs = {
      riskTolerance: risk,
      investmentHorizon: horizon,
      preferredSectors: sectors.length > 0 ? sectors : [...SECTORS],
      favoriteStocks: tickers,
    }
    setPreferences(prefs)
    setLoaded(true)
    // Persist to DynamoDB
    const { saveToServer } = usePreferencesStore.getState()
    await saveToServer()
    navigate('/build')
  }

  const variants = getSlideVariants(direction)

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-2xl mx-auto flex flex-col">
      {/* Progress */}
      <div className="mb-10">
        <ProgressBar current={step} total={TOTAL_STEPS} />
        <p className="mt-3 text-xs text-zinc-400">
          Step {Math.min(step + 1, TOTAL_STEPS)} of {TOTAL_STEPS}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === 0 && <StepRisk value={risk} onChange={setRisk} />}
            {step === 1 && <StepHorizon value={horizon} onChange={setHorizon} />}
            {step === 2 && <StepSectors selected={sectors} onChange={setSectors} />}
            {step === 3 && <StepStocks tickers={tickers} onChange={setTickers} />}
            {showSummary && (
              <Summary risk={risk} horizon={horizon} sectors={sectors} tickers={tickers} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 mt-8 border-t border-zinc-100">
        <button
          onClick={goBack}
          disabled={step === 0}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors disabled:opacity-0 disabled:pointer-events-none"
        >
          Back
        </button>

        {showSummary ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleFinish}
            className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            Generate My Portfolio
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            disabled={!canNext && step < 3}
            className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
          >
            {step === 3 ? (tickers.length === 0 ? 'Skip' : 'Next') : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  )
}
