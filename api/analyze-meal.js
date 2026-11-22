// Kairo meal-photo relay → Groq (Llama 4 vision) or xAI Grok vision, chosen by the key prefix.
// The user's key arrives in the `x-ai-key` header from their own device and is forwarded once.
// Nothing is stored or logged: no key, no photo, no result.
const PROVIDERS = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'], name: 'Groq' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', models: ['grok-4', 'grok-2-vision-1212'], name: 'xAI' },
}
const providerFor = key => (key.startsWith('gsk_') ? 'groq' : 'xai')

const PROMPT = `You are a precise sports nutritionist. Identify every food on the plate in this photo (Indian dishes included), estimate each portion in grams, and estimate calories and macros.
Reply with ONLY minified JSON, no markdown:
{"title":"short dish name","items":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high"}
Use realistic home-portion sizes. If it is not food, reply {"title":"Not food","items":[],"confidence":"low"}.`

function parseJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in model reply')
  return JSON.parse(m[0])
}

// The Android app (Capacitor) runs on https://localhost; allow it (and only it) cross-origin.
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost']

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

  const models = model ? [model, ...prov.models.filter(m => m !== model)] : prov.models
  let lastErr = 'Unknown error'
  for (const m of models) {
    try {
      const r = await fetch(prov.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: m,
          temperature: 0.2,
          max_tokens: 800,
          messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        lastErr = body?.error?.message || body?.error || `${prov.name} error ${r.status}`
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: `${prov.name} rejected the API key. Check it in Kairo Settings.` })
        if (r.status === 429) return res.status(429).json({ error: `${prov.name} rate limit reached. Try again in a minute.` })
        continue // model not available → try the next one
      }
      const out = parseJson(body?.choices?.[0]?.message?.content)
      return res.status(200).json({ ...out, model: m, provider: prov.name })
    } catch (e) {
      lastErr = e?.message || String(e)
    }
  }
  return res.status(502).json({ error: `Could not analyse the photo: ${lastErr}` })
}
