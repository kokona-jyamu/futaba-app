/* lib/theme.ts — テーマカラーの定義と適用 */
'use client'

export type ThemeKey = 'matcha' | 'sakura' | 'sky' | 'apricot' | 'lavender'

export type Theme = {
  key: ThemeKey
  label: string
  /** 見本用の代表色 */
  swatch: string
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    key: 'matcha',
    label: 'まっちゃ',
    swatch: '#6FA98D',
    vars: {
      '--fa-matcha': '#6FA98D',
      '--fa-matcha-deep': '#35695A',
      '--fa-matcha-soft': '#E9F3ED',
      '--fa-bg': '#F7F6F1',
    },
  },
  {
    key: 'sakura',
    label: 'さくら',
    swatch: '#D98CA0',
    vars: {
      '--fa-matcha': '#D98CA0',
      '--fa-matcha-deep': '#8E4759',
      '--fa-matcha-soft': '#FBEDF1',
      '--fa-bg': '#FAF6F5',
    },
  },
  {
    key: 'sky',
    label: 'そら',
    swatch: '#7FA9D6',
    vars: {
      '--fa-matcha': '#7FA9D6',
      '--fa-matcha-deep': '#3F6690',
      '--fa-matcha-soft': '#EAF2FA',
      '--fa-bg': '#F5F7FA',
    },
  },
  {
    key: 'apricot',
    label: 'あんず',
    swatch: '#E0A15C',
    vars: {
      '--fa-matcha': '#E0A15C',
      '--fa-matcha-deep': '#8E5F26',
      '--fa-matcha-soft': '#FDF2E4',
      '--fa-bg': '#FAF7F2',
    },
  },
  {
    key: 'lavender',
    label: 'ふじいろ',
    swatch: '#9B92C8',
    vars: {
      '--fa-matcha': '#9B92C8',
      '--fa-matcha-deep': '#57508A',
      '--fa-matcha-soft': '#EFEDF7',
      '--fa-bg': '#F7F6FA',
    },
  },
]

export const DEFAULT_THEME: ThemeKey = 'matcha'

export const getTheme = (key?: string | null): Theme =>
  THEMES.find((t) => t.key === key) ?? THEMES[0]

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

/* ローカルにも控えておき、次回の読み込み時に一瞬でも既定色が出ないようにする */
const STORAGE_KEY = 'futaba_theme'

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