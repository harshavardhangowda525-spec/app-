// GET /api/sync → { data, updated_at, device } | null      PUT /api/sync { data, device } → { updated_at }
// Requires the Bearer token from /api/auth; each account can only read/write its own row.
import { db, fail, verifyToken } from './_lib.js'

export default async function handler(req, res) {
  try {
    const user = verifyToken(req)
    if (!user) return res.status(401).json({ error: 'Please sign in again.' })
    const sql = db()
    if (req.method === 'GET') {
      const rows = await sql('SELECT data, device, updated_at FROM kairo_sync WHERE user_id = $1', [user.sub])
      return res.status(200).json(rows[0] ? { data: rows[0].data, device: rows[0].device, updated_at: new Date(rows[0].updated_at).toISOString() } : null)
    }
    if (req.method === 'PUT') {
      const { data, device } = req.body || {}
      if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Nothing to save.' })
      const json = JSON.stringify(data)
      if (json.length > 4_000_000) return res.status(413).json({ error: 'Data too large to sync.' })
      const rows = await sql(
        `INSERT INTO kairo_sync (user_id, data, device, updated_at) VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, device = EXCLUDED.device, updated_at = now()
         RETURNING updated_at`, [user.sub, json, String(device || '').slice(0, 40)])
      return res.status(200).json({ updated_at: new Date(rows[0].updated_at).toISOString() })
    }
    return res.status(405).json({ error: 'GET or PUT only' })
  } catch (e) { return fail(res, e) }
}
