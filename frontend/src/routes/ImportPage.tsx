import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  FileText,
  AlertCircle,
  Download,
  Check,
} from 'lucide-react'
import { usePortfolioStore, type Holding } from '@/stores/portfolioStore'
import { savePortfolio } from '@/services/portfolioService'

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
/*  CSV template content                                               */
/* ------------------------------------------------------------------ */
const CSV_TEMPLATE = 'Ticker,Shares,CostBasis\nAAPL,50,175.00\nMSFT,30,380.00\nGOOGL,20,140.00\n'

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'portfolio_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/*  Parse CSV                                                          */
/* ------------------------------------------------------------------ */
function parseCSV(text: string): Holding[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Skip header
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((s) => s.trim())
    return {
      id: crypto.randomUUID(),
      ticker: (parts[0] ?? '').toUpperCase(),
      quantity: parseFloat(parts[1] ?? '0') || 0,
      costBasis: parts[2] ? parseFloat(parts[2]) || undefined : undefined,
    } satisfies Holding
  })
}

/* ------------------------------------------------------------------ */
/*  Holding row component                                              */
/* ------------------------------------------------------------------ */
function HoldingRow({
  holding,
  onUpdate,
  onRemove,
}: {
  holding: Holding
  onUpdate: (updates: Partial<Holding>) => void
  onRemove: () => void
}) {
  const isValidTicker = TICKER_REGEX.test(holding.ticker)
  const hasError = holding.ticker.length > 0 && !isValidTicker

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={hasError ? 'bg-rose-50/50' : ''}
    >
      <td className="px-4 py-3">
        <div className="relative">
          <input
            type="text"
            value={holding.ticker}
            onChange={(e) =>
              onUpdate({ ticker: e.target.value.toUpperCase().slice(0, 5) })
            }
            placeholder="AAPL"
            className={`w-full rounded-xl border px-3 py-2 text-sm font-medium text-zinc-950 placeholder:text-zinc-300 focus:outline-none focus:ring-2 transition-colors ${
              hasError
                ? 'border-rose-300 focus:ring-rose-200'
                : 'border-zinc-200 focus:ring-emerald-200'
            }`}
          />
          {hasError && (
            <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={holding.quantity || ''}
          onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          min={0}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={holding.costBasis ?? ''}
          onChange={(e) =>
            onUpdate({
              costBasis: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          placeholder="0.00"
          min={0}
          step="0.01"
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onRemove}
          className="h-8 w-8 rounded-full hover:bg-rose-50 flex items-center justify-center transition-colors"
        >
          <Trash2 className="h-4 w-4 text-zinc-400 hover:text-rose-500" />
        </button>
      </td>
    </motion.tr>
  )
}

/* ------------------------------------------------------------------ */
/*  Manual mode                                                        */
/* ------------------------------------------------------------------ */
function ManualMode() {
  const navigate = useNavigate()
  const { addPortfolio } = usePortfolioStore()
  const [name, setName] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addHolding = useCallback(() => {
    setHoldings((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ticker: '', quantity: 0 },
    ])
  }, [])

  const updateHolding = useCallback((id: string, updates: Partial<Holding>) => {
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    )
  }, [])

  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const validHoldings = useMemo(
    () =>
      holdings.filter(
        (h) => TICKER_REGEX.test(h.ticker) && h.quantity > 0
      ),
    [holdings]
  )

  const canSubmit = name.trim().length > 0 && validHoldings.length > 0

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const saved = await savePortfolio({ name: name.trim(), type: 'imported', holdings: validHoldings })
      addPortfolio({ ...saved, id: saved.id || (saved as any).portfolioId })
      navigate(`/analyze/${saved.id || (saved as any).portfolioId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save portfolio: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, name, validHoldings, addPortfolio, navigate])

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={CARD}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <FileText className="h-5 w-5 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-950">
          Enter Holdings Manually
        </h2>
      </div>

      {/* Portfolio name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          Portfolio Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Brokerage Portfolio"
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
        />
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto -mx-8 px-8">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Ticker
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Shares
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Cost Basis ($)
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {holdings.map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  onUpdate={(updates) => updateHolding(h.id, updates)}
                  onRemove={() => removeHolding(h.id)}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Add holding button */}
      <button
        onClick={addHolding}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 hover:border-emerald-400 hover:text-emerald-600 transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" /> Add Holding
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100">
        <p className="text-sm text-zinc-500">
          {validHoldings.length} valid holding{validHoldings.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Submitting...
            </>
          ) : (
            <>Submit for Analysis</>
          )}
        </button>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  CSV mode                                                           */
/* ------------------------------------------------------------------ */
function CSVMode() {
  const navigate = useNavigate()
  const { addPortfolio } = usePortfolioStore()
  const [name, setName] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)
    const file = acceptedFiles[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) {
          setError('No valid rows found. Check your CSV format.')
          return
        }
        setHoldings(parsed)
      } catch {
        setError('Failed to parse CSV. Please check the format.')
      }
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  const updateHolding = useCallback((id: string, updates: Partial<Holding>) => {
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    )
  }, [])

  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id))
  }, [])

  const invalidCount = useMemo(
    () => holdings.filter((h) => !TICKER_REGEX.test(h.ticker)).length,
    [holdings]
  )

  const validHoldings = useMemo(
    () =>
      holdings.filter((h) => TICKER_REGEX.test(h.ticker) && h.quantity > 0),
    [holdings]
  )

  const canSubmit =
    name.trim().length > 0 && validHoldings.length > 0

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const saved = await savePortfolio({ name: name.trim(), type: 'imported', holdings: validHoldings })
      addPortfolio({ ...saved, id: saved.id || (saved as any).portfolioId })
      navigate(`/analyze/${saved.id || (saved as any).portfolioId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to import portfolio: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, name, validHoldings, addPortfolio, navigate])

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className={CARD}>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Upload className="h-5 w-5 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-950">Upload CSV</h2>
        </div>

        {/* Portfolio name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Portfolio Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Brokerage Portfolio"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
          />
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-emerald-400 bg-emerald-50/50'
              : fileName
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-zinc-300 hover:border-emerald-400'
          }`}
        >
          <input {...getInputProps()} />
          {fileName ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-zinc-950">{fileName}</p>
              <p className="text-xs text-zinc-500">
                {holdings.length} rows parsed. Drop a new file to replace.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-950">
                {isDragActive
                  ? 'Drop your CSV here'
                  : 'Drag & drop your CSV file'}
              </p>
              <p className="text-xs text-zinc-500">
                or click to browse. Max 5MB, .csv files only.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={downloadTemplate}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Download Template
        </button>
      </div>

      {/* Review table */}
      {holdings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className={CARD}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-zinc-950">
              Review Holdings
            </h3>
            {invalidCount > 0 && (
              <span className="text-xs font-medium text-rose-600 bg-rose-50 rounded-full px-3 py-1">
                {invalidCount} invalid ticker{invalidCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="overflow-x-auto -mx-8 px-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Cost Basis ($)
                  </th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {holdings.map((h) => (
                    <HoldingRow
                      key={h.id}
                      holding={h}
                      onUpdate={(updates) => updateHolding(h.id, updates)}
                      onRemove={() => removeHolding(h.id)}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100">
            <p className="text-sm text-zinc-500">
              {validHoldings.length} valid of {holdings.length} total
            </p>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <motion.div
                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Importing...
                </>
              ) : (
                <>Confirm Import</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ImportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') ?? 'manual'

  return (
    <div className="min-h-[100dvh] px-4 sm:px-6 lg:px-10 py-8 lg:py-12 max-w-[900px] mx-auto">
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

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-zinc-950">
          Import Portfolio
        </h1>
        <p className="mt-2 text-zinc-500 text-sm sm:text-base max-w-[65ch]">
          {mode === 'csv'
            ? 'Upload a CSV file exported from your broker.'
            : 'Manually enter your portfolio holdings.'}
        </p>

        {/* Mode toggle */}
        <div className="inline-flex rounded-full bg-zinc-100 p-1 mt-6">
          {(['manual', 'csv'] as const).map((m) => (
            <button
              key={m}
              onClick={() => navigate(`/analyze/import?mode=${m}`, { replace: true })}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                mode === m ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {mode === m && (
                <motion.div
                  layoutId="import-mode-toggle"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {m === 'manual' ? 'Manual Entry' : 'CSV Upload'}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === 'manual' ? (
          <ManualMode key="manual" />
        ) : (
          <CSVMode key="csv" />
        )}
      </AnimatePresence>
    </div>
  )
}
