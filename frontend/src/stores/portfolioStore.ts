import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getPortfolios as fetchPortfolios,
  savePortfolio as savePortfolioApi,
  deletePortfolio as deletePortfolioApi,
} from '@/services/portfolioService'

export interface Recommendation {
  ticker: string
  companyName: string
  allocationPct: number
  sector: string
  rationale: string
  compositeScore?: number
}

export interface Portfolio {
  id: string
  name: string
  type: 'generated' | 'imported'
  recommendations?: Recommendation[]
  holdings?: Holding[]
  createdAt: string
  preferenceSnapshot?: any
}

export interface Holding {
  id: string
  ticker: string
  companyName?: string
  quantity: number
  costBasis?: number
  currentPrice?: number
  sector?: string
}

interface PortfolioState {
  portfolios: Portfolio[]
  activePortfolio: Portfolio | null
  isGenerating: boolean
  isSyncing: boolean
  setPortfolios: (portfolios: Portfolio[]) => void
  setActivePortfolio: (portfolio: Portfolio | null) => void
  addPortfolio: (portfolio: Portfolio) => void
  removePortfolio: (id: string) => void
  setGenerating: (generating: boolean) => void
  updatePortfolio: (id: string, updates: Partial<Portfolio>) => void
  loadFromServer: () => Promise<void>
  saveToServer: (portfolio: Portfolio) => Promise<Portfolio>
  deleteFromServer: (id: string) => Promise<void>
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      portfolios: [],
      activePortfolio: null,
      isGenerating: false,
      isSyncing: false,

      setPortfolios: (portfolios) => set({ portfolios }),

      setActivePortfolio: (portfolio) => set({ activePortfolio: portfolio }),

      addPortfolio: (portfolio) =>
        set((state) => ({ portfolios: [...state.portfolios, portfolio] })),

      removePortfolio: (id) =>
        set((state) => ({
          portfolios: state.portfolios.filter((p) => p.id !== id),
        })),

      setGenerating: (generating) => set({ isGenerating: generating }),

      updatePortfolio: (id, updates) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      loadFromServer: async () => {
        try {
          set({ isSyncing: true })
          const serverPortfolios = await fetchPortfolios()
          if (serverPortfolios && serverPortfolios.length > 0) {
            // Merge: server data wins for metadata, but keep local holdings/recommendations
            const local = get().portfolios
            const localMap = new Map(local.map((p) => [p.id, p]))
            const merged = serverPortfolios.map((sp) => {
              const lp = localMap.get(sp.id)
              return lp
                ? { ...sp, recommendations: lp.recommendations, holdings: lp.holdings }
                : sp
            })
            set({ portfolios: merged })
          }
        } catch (err) {
          console.warn('Failed to load portfolios from server:', err)
        } finally {
          set({ isSyncing: false })
        }
      },

      saveToServer: async (portfolio: Portfolio) => {
        try {
          set({ isSyncing: true })
          const saved = await savePortfolioApi({
            name: portfolio.name,
            type: portfolio.type,
            recommendations: portfolio.recommendations,
            holdings: portfolio.holdings,
            preferenceSnapshot: portfolio.preferenceSnapshot,
          })
          // Update local store with server-assigned ID
          set((state) => ({
            portfolios: state.portfolios.map((p) =>
              p.id === portfolio.id ? { ...p, ...saved, id: saved.id || p.id } : p
            ),
          }))
          return saved
        } catch (err) {
          console.warn('Failed to save portfolio to server:', err)
          return portfolio
        } finally {
          set({ isSyncing: false })
        }
      },

      deleteFromServer: async (id: string) => {
        try {
          set({ isSyncing: true })
          await deletePortfolioApi(id)
          set((state) => ({
            portfolios: state.portfolios.filter((p) => p.id !== id),
          }))
        } catch (err) {
          console.warn('Failed to delete portfolio from server:', err)
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'investsmart-portfolios',
      partialize: (state) => ({
        portfolios: state.portfolios,
      }),
    }
  )
)
