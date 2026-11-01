/* lib/theme.ts — テーマカラーの定義と適用（定義は API からも参照する） */

import type { Json } from '@/lib/database.types'

export type ThemeKey = 'coral' | 'matcha' | 'sakura' | 'sky' | 'apricot' | 'lavender'

export type Theme = {
  key: ThemeKey
  label: string
  /** 見本用の代表色 */
  swatch: string
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    key: 'coral',
    label: 'コーラル',
    swatch: '#E2725B',
    vars: {
      '--fa-brand': '#E2725B',
      '--fa-brand-deep': '#B5472F',
      '--fa-brand-soft': '#FDEEEA',
    },
  },
  {
    key: 'matcha',
    label: 'まっちゃ',
    swatch: '#6FA98D',
    vars: {
      '--fa-brand': '#6FA98D',
      '--fa-brand-deep': '#35695A',
      '--fa-brand-soft': '#E9F3ED',
    },
  },
  {
    key: 'sakura',
    label: 'さくら',
    swatch: '#D98CA0',
    vars: {
      '--fa-brand': '#D98CA0',
      '--fa-brand-deep': '#8E4759',
      '--fa-brand-soft': '#FBEDF1',
    },
  },
  {
    key: 'sky',
    label: 'そら',
    swatch: '#7FA9D6',
    vars: {
      '--fa-brand': '#7FA9D6',
      '--fa-brand-deep': '#3F6690',
      '--fa-brand-soft': '#EAF2FA',
    },
  },
  {
    key: 'apricot',
    label: 'あんず',
    swatch: '#E0A15C',
    vars: {
      '--fa-brand': '#E0A15C',
      '--fa-brand-deep': '#8E5F26',
      '--fa-brand-soft': '#FDF2E4',
    },
  },
  {
    key: 'lavender',
    label: 'ふじいろ',
    swatch: '#9B92C8',
    vars: {
      '--fa-brand': '#9B92C8',
      '--fa-brand-deep': '#57508A',
      '--fa-brand-soft': '#EFEDF7',
    },
  },
]

export const DEFAULT_THEME: ThemeKey = 'coral'

export const getTheme = (key?: string | null): Theme =>
  THEMES.find((t) => t.key === key) ?? THEMES[0]

/** guardians.settings（jsonb）に、ほかの設定を残したままテーマを書き込む */
export const settingsWithTheme = (settings: unknown, theme: ThemeKey): { [key: string]: Json | undefined } => {
  const base =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as { [key: string]: Json | undefined })
      : {}
  return { ...base, theme }
}

/** guardians.settings（jsonb）から、保存されているテーマを取り出す。なければ null */
export const themeOfSettings = (settings: unknown): ThemeKey | null => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null
  const key = (settings as { theme?: unknown }).theme
  return THEMES.some((t) => t.key === key) ? (key as ThemeKey) : null
}

/** :root に CSS 変数を上書きする */
export function applyTheme(key?: string | null) {
  if (typeof document === 'undefined') return
  const theme = getTheme(key)
  const root = document.documentElement
  /* いったん全テーマの変数を消してから当てる */
  THEMES.forEach((t) =>
    Object.keys(t.vars).forEach((v) => root.style.removeProperty(v))
  )
  Object.entries(theme.vars).forEach(([v, value]) =>
    root.style.setProperty(v, value)
  )
}

/* ローカルにも控えておき、次回の読み込み時に一瞬でも既定色が出ないようにする。
   以前の控え（futaba_theme）は選んでいない人にも既定の緑が入っているので使わない */
const STORAGE_KEY = 'futaba_theme_v2'

export const saveThemeLocal = (key: ThemeKey) => {
  try { localStorage.setItem(STORAGE_KEY, key) } catch {}
}

export const loadThemeLocal = (): ThemeKey => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && THEMES.some((t) => t.key === v)) return v as ThemeKey
  } catch {}
  return DEFAULT_THEME
}