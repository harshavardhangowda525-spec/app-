import type { FoodItem } from './types'

const KEY = 'kairo-xai-key'
const MODEL = 'kairo-xai-model'
/** The xAI key lives only in this device's localStorage — never in code, backups or the Kairo store. */
export const getXaiKey = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
export const setXaiKey = (k: string) => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY) } catch { /* ignore */ } }
export const getXaiModel = () => { try { return localStorage.getItem(MODEL) ?? '' } catch { return '' } }
export const setXaiModel = (m: string) => { try { m ? localStorage.setItem(MODEL, m.trim()) : localStorage.removeItem(MODEL) } catch { /* ignore */ } }

export interface MealAnalysis { title: string; items: FoodItem[]; confidence?: string; model?: string }

/** Downscale for upload + on-device storage (keeps a POCO C55 fast and IndexedDB small). */
export async function compressImage(file: File, max = 1024, q = 0.72): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    const s = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', q)
  } finally { URL.revokeObjectURL(url) }
}

export async function analyzeMeal(image: string): Promise<MealAnalysis> {
  const key = getXaiKey()
  if (!key) throw new Error('Add your xAI (Grok) API key in Settings to analyse photos.')
  const r = await fetch('/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-xai-key': key },
    body: JSON.stringify({ image, model: getXaiModel() || undefined }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error || `Analysis failed (${r.status})`)
  const items: FoodItem[] = (Array.isArray(body.items) ? body.items : []).map((i: Record<string, unknown>) => ({
    name: String(i.name ?? 'Food'), grams: Number(i.grams) || undefined,
    kcal: Math.max(0, Number(i.kcal) || 0), protein: Math.max(0, Number(i.protein) || 0),
    carbs: Math.max(0, Number(i.carbs) || 0), fat: Math.max(0, Number(i.fat) || 0),
  }))
  return { title: String(body.title || 'Meal'), items, confidence: body.confidence, model: body.model }
}
