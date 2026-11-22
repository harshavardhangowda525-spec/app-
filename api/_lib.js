// Shared helpers for Kairo's account & sync functions (files starting with _ are not routes on Vercel).
import { neon } from '@neondatabase/serverless'
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt)
const b64u = b => Buffer.from(b).toString('base64url')

export function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw Object.assign(new Error('Cloud sync is not configured on the server.'), { status: 503 })
  return neon(url)
}

function secret() {
  const s = process.env.KAIRO_JWT_SECRET
  if (!s || s.length < 32) throw Object.assign(new Error('Cloud sync is not configured on the server.'), { status: 503 })
  return s
}

export async function hashPassword(pw) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$')
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 })
  const want = Buffer.from(keyHex, 'hex')
  return want.length === key.length && timingSafeEqual(want, key)
}

/** Minimal HS256 JWT (sub = user id), 60-day expiry. */
export function signToken(sub, email) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify({ sub, email, exp: Math.floor(Date.now() / 1000) + 60 * 24 * 3600 }))
  const sig = createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

export function verifyToken(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/)
  if (!m) return null
  const [head, body, sig] = m[1].split('.')
  if (!head || !body || !sig) return null
  const want = createHmac('sha256', secret()).update(`${head}.${body}`).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() / 1000 && p.sub ? p : null
  } catch { return null }
}

export const fail = (res, e) => res.status(e?.status || 500).json({ error: e?.status ? e.message : 'Server error — please try again.' })
