import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  Target,
  TrendingUp,
  Clock,
  ArrowRight,
  Check,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { usePreferencesStore } from '@/stores/preferencesStore'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const RISK_OPTIONS = [
  { value: 'Conservative' as const, icon: Shield, label: 'Conservative' },
  { value: 'Moderate' as const, icon: Target, label: 'Moderate' },
  { value: 'Aggressive' as const, icon: TrendingUp, label: 'Aggressive' },
]

const HORIZON_OPTIONS = [
  { value: 'Short-term' as const, label: 'Short-term', sub: '< 1 year' },
  { value: 'Medium-term' as const, label: 'Medium-term', sub: '1 - 5 years' },
  { value: 'Long-term' as const, label: 'Long-term', sub: '5+ years' },
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

/* ------------------------------------------------------------------ */
/*  Ticker validation                                                  */
/* ------------------------------------------------------------------ */
function isValidTicker(value: string): boolean {
  return /^[A-Z]{1,5}$/.test(value.toUpperCase().trim())
}

/* ------------------------------------------------------------------ */
/*  Card wrapper                                                       */
/* ------------------------------------------------------------------ */
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
}

function SectionCard({
  title,
  children,
  delay = 0,
}: {
  title: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className="bg-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-zinc-200/50 p-8"
    >
      <h2 className="text-base font-semibold text-zinc-950 mb-5">{title}</h2>
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main preferences page                                              */
/* ------------------------------------------------------------------ */
export default function PreferencesPage() {
  const navigate = useNavigate()
  const { preferences, setPreferences, setLoaded } = usePreferencesStore()

  // Local draft so user can edit without instant commits
  const [risk, setRisk] = useState(preferences.riskTolerance)
  const [horizon, setHorizon] = useState(preferences.investmentHorizon)
  const [sectors, setSectors] = useState<string[]>(preferences.preferredSectors)
  const [tickers, setTickers] = useState<string[]>(preferences.favoriteStocks)

  const [tickerInput, setTickerInput] = useState('')
  const [tickerError, setTickerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showRegenerate, setShowRegenerate] = useState(false)

  // Sync if store updates externally
  useEffect(() => {
    setRisk(preferences.riskTolerance)
    setHorizon(preferences.investmentHorizon)
    setSectors(preferences.preferredSectors)
    setTickers(preferences.favoriteStocks)
  }, [preferences])

  const addTicker = useCallback(() => {
    const raw = tickerInput.toUpperCase().trim()
    if (!raw) return
    if (!isValidTicker(raw)) {
      setTickerError('Enter a valid ticker (1-5 letters)')
      return
    }
    if (tickers.includes(raw)) {
      setTickerError(`${raw} is already added`)
      return
    }
    setTickerError(null)
    setTickers((prev) => [...prev, raw])
    setTickerInput('')
  }, [tickerInput, tickers])

  const removeTicker = (t: string) => setTickers((prev) => prev.filter((x) => x !== t))

  const toggleSector = (sector: string) => {
    setSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    )
  }

  const handleSave = async () => {
    setPreferences({
      riskTolerance: risk,
      investmentHorizon: horizon,
      preferredSectors: sectors.length > 0 ? sectors : [...SECTORS],
      favoriteStocks: tickers,
    })
    setLoaded(true)
    setSaved(true)
    setShowRegenerate(true)
    // Persist to DynamoDB
    const { saveToServer } = usePreferencesStore.getState()
    await saveToServer()
    setTimeout(() => setSaved(false), 2500)
  }

  const isDirty =
    risk !== preferences.riskTolerance ||
    horizon !== preferences.investmentHorizon ||
    JSON.stringify(sectors) !== JSON.stringify(preferences.preferredSectors) ||
    JSON.stringify(tickers) !== JSON.stringify(preferences.favoriteStocks)

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[1100px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="mb-10"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 transition-colors mb-4"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
          Investment Preferences
        </h1>
        <p className="mt-1.5 text-zinc-500 text-sm sm:text-base max-w-lg">
          Update your preferences to fine-tune portfolio generation.
        </p>
      </motion.div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Risk Tolerance */}
        <SectionCard title="Risk Tolerance" delay={0}>
          <div className="grid gap-3">
            {RISK_OPTIONS.map((opt) => {
              const selected = risk === opt.value
              return (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setRisk(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50/60'
                      : 'border-zinc-200/70 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-emerald-100' : 'bg-zinc-50'
                    }`}
                  >
                    <opt.icon
                      className={`h-4 w-4 ${selected ? 'text-emerald-600' : 'text-zinc-400'}`}
                    />
                  </div>
                  <span className="text-sm font-semibold text-zinc-950">{opt.label}</span>
                  {selected && (
                    <div className="ml-auto h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </SectionCard>

        {/* Investment Horizon */}
        <SectionCard title="Investment Horizon" delay={0.05}>
          <div className="grid gap-3">
            {HORIZON_OPTIONS.map((opt) => {
              const selected = horizon === opt.value
              return (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setHorizon(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50/60'
                      : 'border-zinc-200/70 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-emerald-100' : 'bg-zinc-50'
                    }`}
                  >
                    <Clock
                      className={`h-4 w-4 ${selected ? 'text-emerald-600' : 'text-zinc-400'}`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-950">{opt.label}</span>
                    <span className="text-xs text-zinc-400 ml-1.5">({opt.sub})</span>
                  </div>
                  {selected && (
                    <div className="ml-auto h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </SectionCard>

        {/* Preferred Sectors */}
        <SectionCard title="Preferred Sectors" delay={0.1}>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => {
              const active = sectors.includes(sector)
              return (
                <motion.button
                  key={sector}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => toggleSector(sector)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
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
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setSectors([...SECTORS])}
              className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
            >
              Select all
            </button>
            <button
              onClick={() => setSectors([])}
              className="text-xs text-zinc-400 font-medium hover:text-zinc-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </SectionCard>

        {/* Favorite Stocks */}
        <SectionCard title="Favorite Stocks" delay={0.15}>
          <div className="flex gap-2">
            <input
              value={tickerInput}
              onChange={(e) => {
                setTickerInput(e.target.value.toUpperCase())
                setTickerError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTicker()
                }
              }}
              placeholder="e.g. AAPL"
              maxLength={5}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-shadow"
            />
            <button
              onClick={addTicker}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {tickerError && <p className="text-sm text-red-500 mt-2">{tickerError}</p>}

          {tickers.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {tickers.map((t) => (
                <motion.span
                  key={t}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700"
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
          ) : (
            <p className="text-sm text-zinc-400 mt-4">No favorite stocks added.</p>
          )}
        </SectionCard>
      </div>

      {/* Save bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 24 }}
        className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={!isDirty && !saved}
          className={`rounded-full px-8 py-3 text-sm font-semibold shadow-md transition-colors inline-flex items-center gap-2 ${
            saved
              ? 'bg-emerald-100 text-emerald-700'
              : isDirty
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            'Save Preferences'
          )}
        </motion.button>

        {showRegenerate && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/build')}
            className="rounded-full border-2 border-emerald-600 px-6 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors inline-flex items-center gap-2"
          >
            Regenerate Portfolios
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
