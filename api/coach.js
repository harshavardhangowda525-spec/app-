// POST /api/coach { summary } with header x-ai-key → { text }  (weekly AI coach)
// Uses the user's own Groq (gsk_) or xAI (xai-) key, forwarded once. Only summary numbers are sent — no journal text, no photos.
const PROVIDERS = {
  groq: { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', modelsUrl: 'https://api.groq.com/openai/v1/models', models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'], pick: /gpt-oss|qwen|llama|kimi|mistral|gemma/i },
  xai: { name: 'xAI', url: 'https://api.x.ai/v1/chat/completions', modelsUrl: 'https://api.x.ai/v1/models', models: ['grok-4', 'grok-3-mini'], pick: /grok/i },
}

const SYSTEM = `You are a direct, practical productivity coach for one person: an Indian student-founder who runs a web/app agency, studies NIOS, practises trading, trains at the gym on a lean bulk and creates content. Fixed daily routine 5:00 AM–9:30 PM.
Given this week's and last week's numbers (JSON), reply with EXACTLY 3 numbered suggestions, each 1–2 sentences, each citing a specific number from the data and a concrete action for next week. No greetings, no generic advice, no medical claims. If data is thin, say what to log.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = req.headers['x-ai-key']
  if (!key || typeof key !== 'string' || key.length < 20) return res.status(400).json({ error: 'Add your Groq key in Settings to use the coach.' })
  const summary = req.body?.summary
  if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'No summary sent.' })
  const json = JSON.stringify(summary)
  if (json.length > 20000) return res.status(413).json({ error: 'Summary too large.' })
  const prov = PROVIDERS[key.startsWith('gsk_') ? 'groq' : 'xai']
  const tried = new Set()
  let queue = [...prov.models], discovered = false, lastErr = 'Unknown error'
  while (queue.length) {
    const model = queue.shift()
    if (tried.has(model)) continue
    tried.add(model)
    try {
      const r = await fetch(prov.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, temperature: 0.4, max_tokens: 1200,
          ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: json }],
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (r.ok) {
        const text = String(body?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
        if (text) return res.status(200).json({ text, model })
        lastErr = 'Empty reply'
      } else {
        lastErr = body?.error?.message || `${prov.name} error ${r.status}`
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: `${prov.name} rejected the API key.` })
        if (r.status === 429) return res.status(429).json({ error: `${prov.name} rate limit reached. Try again in a minute.` })
      }
    } catch (e) { lastErr = e?.message || String(e) }
    if (!queue.length && !discovered) {
      discovered = true
      try {
        const m = await fetch(prov.modelsUrl, { headers: { Authorization: `Bearer ${key}` } })
        if (m.ok) queue = ((await m.json())?.data || []).map(x => x.id).filter(id => prov.pick.test(id) && !/whisper|tts|guard|vision|embed/i.test(id) && !tried.has(id)).slice(0, 4)
      } catch { /* ignore */ }
    }
  }
  return res.status(502).json({ error: `Coach unavailable (${prov.name}): ${lastErr}` })
}
