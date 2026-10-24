import { createContext, useContext } from 'react'
import type { Preferences } from './api'

export const PreferencesContext = createContext<{ value: Preferences | null; error: string; update: (value: Preferences) => Promise<void>; reload: () => void }>({ value: null, error: '', update: () => Promise.reject(new Error('Preferensi belum dimuat.')), reload: () => {} })
export const usePreferences = () => useContext(PreferencesContext)
