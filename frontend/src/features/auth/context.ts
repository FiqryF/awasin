import { createContext } from 'react'
import type { Identity } from './identity'

export type AuthState = { loading: boolean; identity: Identity | null; error: string; refresh: () => Promise<Identity | null> }
export const AuthContext = createContext<AuthState>({ loading: false, identity: null, error: '', refresh: async () => null })
