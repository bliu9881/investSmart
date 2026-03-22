import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getPreferences,
  savePreferences as savePreferencesApi,
} from '@/services/preferencesService'

interface PreferenceProfile {
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive' | null
  preferredSectors: string[]
  favoriteStocks: string[]
  investmentHorizon: 'Short-term' | 'Medium-term' | 'Long-term' | null
}

interface PreferencesState {
  preferences: PreferenceProfile
  isLoaded: boolean
  isSyncing: boolean
  setPreferences: (prefs: Partial<PreferenceProfile>) => void
  resetPreferences: () => void
  setLoaded: (loaded: boolean) => void
  loadFromServer: () => Promise<void>
  saveToServer: () => Promise<void>
}

const defaultPreferences: PreferenceProfile = {
  riskTolerance: null,
  preferredSectors: [],
  favoriteStocks: [],
  investmentHorizon: null,
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,
      isLoaded: false,
      isSyncing: false,

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      resetPreferences: () => set({ preferences: defaultPreferences }),

      setLoaded: (loaded) => set({ isLoaded: loaded }),

      loadFromServer: async () => {
        try {
          set({ isSyncing: true })
          const serverPrefs = await getPreferences()
          if (serverPrefs) {
            set({
              preferences: {
                riskTolerance: (serverPrefs.riskTolerance as PreferenceProfile['riskTolerance']) ?? null,
                preferredSectors: serverPrefs.preferredSectors ?? [],
                favoriteStocks: serverPrefs.favoriteStocks ?? [],
                investmentHorizon: (serverPrefs.investmentHorizon as PreferenceProfile['investmentHorizon']) ?? null,
              },
              isLoaded: true,
            })
          } else {
            set({ isLoaded: true })
          }
        } catch (err) {
          console.warn('Failed to load preferences from server:', err)
          set({ isLoaded: true })
        } finally {
          set({ isSyncing: false })
        }
      },

      saveToServer: async () => {
        const { preferences } = get()
        if (!preferences.riskTolerance || !preferences.investmentHorizon) return

        try {
          set({ isSyncing: true })
          await savePreferencesApi({
            riskTolerance: preferences.riskTolerance,
            preferredSectors: preferences.preferredSectors,
            favoriteStocks: preferences.favoriteStocks,
            investmentHorizon: preferences.investmentHorizon,
          })
        } catch (err) {
          console.warn('Failed to save preferences to server:', err)
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'investsmart-preferences',
    }
  )
)
