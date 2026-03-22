import { create } from 'zustand'

type ActiveFlow = 'build' | 'analyze'

interface UIState {
  activeFlow: ActiveFlow
  chatOpen: boolean
  comparisonTickers: string[]
  setActiveFlow: (flow: ActiveFlow) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  addComparisonTicker: (ticker: string) => void
  removeComparisonTicker: (ticker: string) => void
  clearComparisonTickers: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeFlow: 'build',
  chatOpen: false,
  comparisonTickers: [],
  setActiveFlow: (flow) => set({ activeFlow: flow }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
  addComparisonTicker: (ticker) =>
    set((state) => {
      if (state.comparisonTickers.length >= 5) return state
      if (state.comparisonTickers.includes(ticker)) return state
      return { comparisonTickers: [...state.comparisonTickers, ticker] }
    }),
  removeComparisonTicker: (ticker) =>
    set((state) => ({
      comparisonTickers: state.comparisonTickers.filter((t) => t !== ticker),
    })),
  clearComparisonTickers: () => set({ comparisonTickers: [] }),
}))
