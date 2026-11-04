import { useEffect, useState } from 'react'
import { seedProfile, SEED_VERSION } from '../data/seed'
import type { Application, Profile, Settings } from '../types'

const DB_KEY = 'antu-cv-db'
const SETTINGS_KEY = 'antu-cv-settings'
const HISTORY_KEY = 'antu-cv-history'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function usePersisted<T>(key: string, init: () => T) {
  const [value, setValue] = useState<T>(init)
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

export function cloneSeed(): Profile {
  return structuredClone(seedProfile)
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => {
    const stored = load<{ v: number; profile: Profile } | null>(DB_KEY, null)
    if (stored && stored.v === SEED_VERSION && stored.profile) return stored.profile
    return cloneSeed()
  })
  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify({ v: SEED_VERSION, profile }))
  }, [profile])
  return [profile, setProfile] as const
}

export const defaultModels: Record<Settings['provider'], string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
  none: '',
}

export function useSettings() {
  return usePersisted<Settings>(SETTINGS_KEY, () =>
    load<Settings>(SETTINGS_KEY, { provider: 'none', apiKey: '', model: '' }),
  )
}

export function useHistory() {
  return usePersisted<Application[]>(HISTORY_KEY, () => load<Application[]>(HISTORY_KEY, []))
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
