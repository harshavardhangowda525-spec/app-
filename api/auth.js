// POST /api/auth  { action: 'signup' | 'signin', email, password } → { token, email }
import { db, fail, hashPassword, signToken, verifyPassword } from './_lib.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const slow = () => new Promise(r => setTimeout(r, 400)) // blunt brute-force attempts

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { action, email: rawEmail, password } = req.body || {}
    const email = String(rawEmail || '').trim().toLowerCase()
    if (!EMAIL.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email.' })
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    const sql = db()
    if (action === 'signup') {
      const existing = await sql('SELECT 1 FROM kairo_users WHERE email = $1', [email])
      if (existing.length) return res.status(409).json({ error: 'That email already has an account — sign in instead.' })
      const rows = await sql('INSERT INTO kairo_users (email, pw_hash) VALUES ($1, $2) RETURNING id', [email, await hashPassword(password)])
      return res.status(200).json({ token: signToken(rows[0].id, email), email })
    }
    if (action === 'signin') {
      const rows = await sql('SELECT id, pw_hash FROM kairo_users WHERE email = $1', [email])
      if (!rows.length || !(await verifyPassword(password, rows[0].pw_hash))) { await slow(); return res.status(401).json({ error: 'Wrong email or password.' }) }
      return res.status(200).json({ token: signToken(rows[0].id, email), email })
    }
    return res.status(400).json({ error: 'Unknown action.' })
  } catch (e) { return fail(res, e) }
}
