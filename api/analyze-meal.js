// Kairo meal-photo relay → Groq or xAI Grok vision, chosen by the key prefix (gsk_ = Groq, xai- = xAI).
// The user's key arrives in the `x-ai-key` header from their own device and is forwarded once.
// Nothing is stored or logged: no key, no photo, no result.
const PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    // Groq retires models often (Llama 4 Scout/Maverick are gone). Known-good first, then live discovery.
    models: ['qwen/qwen3.8-27b'],
    vision: /qwen3\.\d+-27b|vision|[-_/]vl\b|-vl-|muse|llava|llama-4|gemma-?3/i,
    jsonMode: true,
  },
  xai: {
    name: 'xAI',
    url: 'https://api.x.ai/v1/chat/completions',
    modelsUrl: 'https://api.x.ai/v1/models',
    models: ['grok-4', 'grok-2-vision-1212'],
    vision: /vision|grok-4|grok-5/i,
    jsonMode: false,
  },
}
const providerFor = key => (key.startsWith('gsk_') ? 'groq' : 'xai')

// The Android app (Capacitor) runs on https://localhost; allow it (and only it) cross-origin.
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost']

const PROMPT = `You are a precise sports nutritionist. Identify every food on the plate in this photo (Indian dishes included), estimate each portion in grams, and estimate calories and macros.
Reply with ONLY a JSON object, no markdown, no explanation:
{"title":"short dish name","items":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high"}
Use realistic home-portion sizes. If it is not food, reply {"title":"Not food","items":[],"confidence":"low"}.`

export function parseJson(text) {
  let s = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim()
  try { return JSON.parse(s) } catch { /* fall through */ }
  // last balanced-looking {...} that contains "items"
  const candidates = s.match(/\{[\s\S]*\}/g) || []
  for (const c of candidates.reverse()) { try { const o = JSON.parse(c); if (o && typeof o === 'object') return o } catch { /* next */ } }
  const first = s.indexOf('{'), last = s.lastIndexOf('}')
  if (first >= 0 && last > first) return JSON.parse(s.slice(first, last + 1))
  throw new Error('The AI reply was not valid JSON')
}

const isModelError = (status, msg) =>
  status === 404 || /model|decommission|deprecat|not found|does not exist|not supported|unsupported|vision|image/i.test(msg || '')

async function callModel(prov, key, model, image, useJson) {
  const r = await fetch(prov.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      ...(useJson ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
    }),
  })
  const body = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, body, msg: body?.error?.message || (typeof body?.error === 'string' ? body.error : '') }
}

async function discoverModels(prov, key, tried) {
  try {
    const r = await fetch(prov.modelsUrl, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) return []
    const j = await r.json()
    return (j?.data || []).map(m => m.id).filter(id => prov.vision.test(id) && !tried.has(id)).slice(0, 4)
  } catch { return [] }
}

export default async function handler(req, res) {
  const origin = req.headers.origin
  if (origin && APP_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ai-key, x-xai-key')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = req.headers['x-ai-key'] || req.headers['x-xai-key']
  if (!key || typeof key !== 'string' || key.length < 20) return res.status(400).json({ error: 'Missing AI key — add your Groq or xAI key in Kairo Settings.' })
  const prov = PROVIDERS[providerFor(key)]
  const { image, model } = req.body || {}
  if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 4_000_000)
    return res.status(400).json({ error: 'Send one compressed image (data URL, under ~3 MB).' })

  const tried = new Set()
  let queue = model ? [model, ...prov.models.filter(m => m !== model)] : [...prov.models]
  let discovered = false, lastErr = 'Unknown error'

  while (queue.length) {
    const m = queue.shift()
    if (tried.has(m)) continue
    tried.add(m)
    try {
      let out = await callModel(prov, key, m, image, prov.jsonMode)
      // some models reject JSON mode with images — retry once without it
      if (!out.ok && prov.jsonMode && /response_format|json/i.test(out.msg)) out = await callModel(prov, key, m, image, false)
      if (out.ok) {
        const parsed = parseJson(out.body?.choices?.[0]?.message?.content)
        return res.status(200).json({ ...parsed, model: m, provider: prov.name })
      }
      lastErr = out.msg || `${prov.name} error ${out.status}`
      if (out.status === 401 || out.status === 403) return res.status(401).json({ error: `${prov.name} rejected the API key. Check it in Kairo Settings (or create a new key).` })
      if (out.status === 429) return res.status(429).json({ error: `${prov.name} rate limit reached. Try again in a minute.` })
      if (out.status === 413) return res.status(413).json({ error: 'Photo too large for the AI — try again (Kairo compresses it automatically).' })
    } catch (e) {
      lastErr = e?.message || String(e)
    }
    // the current model list ran out (e.g. retired models) → ask the provider which vision models exist now
    if (!queue.length && !discovered) { discovered = true; queue = await discoverModels(prov, key, tried) }
  }
  return res.status(502).json({ error: `Could not analyse the photo (${prov.name}): ${lastErr}` })
}
