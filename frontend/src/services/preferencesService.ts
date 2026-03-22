import { apiRequest } from './api'

export interface PreferenceProfile {
  riskTolerance: string
  preferredSectors: string[]
  favoriteStocks: string[]
  investmentHorizon: string
}

export async function getPreferences(): Promise<PreferenceProfile | null> {
  try {
    const result = await apiRequest<{ preferences: PreferenceProfile | null }>('/preferences')
    return result.preferences
  } catch {
    return null
  }
}

export async function savePreferences(prefs: PreferenceProfile): Promise<PreferenceProfile> {
  const result = await apiRequest<{ preferences: PreferenceProfile }>('/preferences', {
    method: 'POST',
    body: prefs,
  })
  return result.preferences
}
