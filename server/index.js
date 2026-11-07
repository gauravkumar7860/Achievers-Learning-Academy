import express from 'express'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import { readdirSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const app = express()
app.use(express.json())

// Verifies the caller's Supabase JWT and requires role = admin
async function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const { data } = await sb.auth.getUser(token)
  if (!data?.user) return res.status(401).json({ error: 'Not signed in' })
  const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
  if (p?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  req.user = data.user
  next()
}
const audit = (req, action, details) => sb.from('audit_logs').insert({ actor_id: req.user.id, action, details })

// Create a student (auth user + profile + student record)
app.post('/api/admin/students', requireAdmin, async (req, res) => {
  const b = req.body
  if (!b.email || !b.password || b.password.length < 8 || !b.full_name) return res.status(400).json({ error: 'Name, email and a password of 8+ characters are required' })
  const { data, error } = await sb.auth.admin.createUser({ email: b.email, password: b.password, email_confirm: true })
  if (error) return res.status(400).json({ error: error.message })
  const id = data.user.id
  const p = await sb.from('profiles').insert({ id, role: 'student', full_name: b.full_name, email: b.email, phone: b.phone || null })
  const s = !p.error && await sb.from('students').insert({
    profile_id: id, class_id: b.class_id || null, session_id: b.session_id || null, guardian_name: b.guardian_name || null,
    guardian_phone: b.guardian_phone || null, address: b.address || null, admission_date: b.admission_date || new Date().toISOString().slice(0, 10)
  }).select().single()
  if (p.error || s.error) { await sb.auth.admin.deleteUser(id); return res.status(400).json({ error: (p.error || s.error).message }) }
  await audit(req, 'student.create', { student_code: s.data.student_code, name: b.full_name })
  res.json({ student: s.data })
})

app.post('/api/admin/students/:profileId/password', requireAdmin, async (req, res) => {
  if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' })
  const { error } = await sb.auth.admin.updateUserById(req.params.profileId, { password: req.body.password })
  if (error) return res.status(400).json({ error: error.message })
  await audit(req, 'student.password_reset', { profile_id: req.params.profileId })
  res.json({ ok: true })
})

app.delete('/api/admin/students/:profileId', requireAdmin, async (req, res) => {
  const { error } = await sb.auth.admin.deleteUser(req.params.profileId)
  if (error) return res.status(400).json({ error: error.message })
  await audit(req, 'student.delete', { profile_id: req.params.profileId })
  res.json({ ok: true })
})

// Phase 2 drop-in: any file in server/routes/*.js exporting default (app, {requireAdmin, sb, audit}) is auto-loaded
try {
  const dir = path.join(__dirname, 'routes')
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) (await import('./routes/' + f)).default(app, { requireAdmin, sb, audit })
} catch { /* no extra routes yet */ }

const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')))
app.listen(process.env.PORT || 10000, () => console.log('Server running'))
