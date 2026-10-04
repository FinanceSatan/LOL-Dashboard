import { useMemo } from 'react'
import type { Language } from '@shared/types'
import { useApp } from '@/store/app'
import en from './en'
import fa from './fa'

export type TKey = keyof typeof en
type Params = Record<string, string | number | null | undefined>

const dicts: Record<Language, Record<string, string | string[]>> = { en, fa }

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k]
    if (v == null) return ''
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1)
    return v
  })
}

export function translate(lang: Language, key: string, params?: Params): string {
  const v = dicts[lang][key] ?? dicts.en[key]
  if (v == null) return key
  return interpolate(Array.isArray(v) ? v.join(' ') : v, params)
}

export function translateArr(lang: Language, key: string, params?: Params): string[] {
  const v = dicts[lang][key] ?? dicts.en[key]
  if (v == null) return []
  return (Array.isArray(v) ? v : [v]).map((s) => interpolate(s, params))
}

export interface TFunc {
  (key: TKey, params?: Params): string
  /** dynamic keys (coach rules, metric names …) */
  d: (key: string, params?: Params) => string
  arr: (key: string, params?: Params) => string[]
  has: (key: string) => boolean
  /** translated error message for an error code coming from the main process */
  err: (code?: string) => string
  lang: Language
  dir: 'rtl' | 'ltr'
}

export function useT(): TFunc {
  const lang = useApp((s) => s.settings?.language ?? 'fa')
  return useMemo(() => {
    const t = ((key: TKey, params?: Params) => translate(lang, key, params)) as TFunc
    t.d = (key, params) => translate(lang, key, params)
    t.arr = (key, params) => translateArr(lang, key, params)
    t.has = (key) => key in dicts.en
    t.err = (code) => {
      if (!code) return translate(lang, 'error.unknown')
      const base = code.startsWith('HTTP_5') ? 'SERVER' : code.split(':')[0]
      return `error.${base}` in dicts.en ? translate(lang, `error.${base}`) : code
    }
    t.lang = lang
    t.dir = lang === 'fa' ? 'rtl' : 'ltr'
    return t
  }, [lang])
}
