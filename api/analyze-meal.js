// Kairo meal-photo relay → xAI Grok vision.
// The user's xAI key arrives in the `x-xai-key` header from their own device and is forwarded once.
// Nothing is stored or logged: no key, no photo, no result.
const XAI_URL = 'https://api.x.ai/v1/chat/completions'
const DEFAULT_MODELS = ['grok-4', 'grok-2-vision-1212']

const PROMPT = `You are a precise sports nutritionist. Identify every food on the plate in this photo (Indian dishes included), estimate each portion in grams, and estimate calories and macros.
Reply with ONLY minified JSON, no markdown:
{"title":"short dish name","items":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high"}
Use realistic home-portion sizes. If it is not food, reply {"title":"Not food","items":[],"confidence":"low"}.`

function parseJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in model reply')
  return JSON.parse(m[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = req.headers['x-xai-key']
  if (!key || typeof key !== 'string' || key.length < 20) return res.status(400).json({ error: 'Missing xAI API key — add it in Kairo Settings.' })
  const { image, model } = req.body || {}
  if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 4_000_000)
    return res.status(400).json({ error: 'Send one compressed image (data URL, under ~3 MB).' })

  const models = model ? [model, ...DEFAULT_MODELS.filter(m => m !== model)] : DEFAULT_MODELS
  let lastErr = 'Unknown error'
  for (const m of models) {
    try {
      const r = await fetch(XAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: m,
          temperature: 0.2,
          messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image, detail: 'high' } }, { type: 'text', text: PROMPT }] }],
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        lastErr = body?.error?.message || body?.error || `xAI error ${r.status}`
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: 'xAI rejected the API key. Check it in Kairo Settings.' })
        if (r.status === 429) return res.status(429).json({ error: 'xAI rate limit or credits exhausted. Try again shortly.' })
        continue // model not available → try the next one
      }
      const out = parseJson(body?.choices?.[0]?.message?.content)
      return res.status(200).json({ ...out, model: m })
    } catch (e) {
      lastErr = e?.message || String(e)
    }
  }
  return res.status(502).json({ error: `Could not analyse the photo: ${lastErr}` })
}
