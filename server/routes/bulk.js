import crypto from 'crypto'

// Bulk student import: POST /api/admin/students/bulk  { rows: [...] }  (max 200 per request)
const toIso = s => { s = String(s || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '' }

export default function (app, { requireAdmin, sb, audit }) {
  app.post('/api/admin/students/bulk', requireAdmin, async (req, res) => {
    const rows = req.body.rows
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows received' })
    if (rows.length > 200) return res.status(400).json({ error: 'Maximum 200 students per import' })
    const { data: classes } = await sb.from('classes').select('id,name')
    const { data: session } = await sb.from('academic_sessions').select('id').eq('is_current', true).maybeSingle()
    const norm = s => String(s || '').trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
    const results = []
    for (const [i, r] of rows.entries()) {
      const line = i + 2
      const fail = msg => results.push({ line, name: r.full_name, email: r.email, ok: false, error: msg })
      const name = String(r.full_name || '').trim(), email = String(r.email || '').trim().toLowerCase()
      if (!name) { fail('Name is missing'); continue }
      if (!/^\S+@\S+\.\S+$/.test(email)) { fail('Email is not valid'); continue }
      const cls = classes.find(c => norm(c.name) === norm(r.class))
      if (!cls) { fail(`Class "${r.class || ''}" not found`); continue }
      const ad = r.admission_date ? toIso(r.admission_date) : ''
      if (r.admission_date && !ad) { fail('Admission date must be DD/MM/YYYY'); continue }
      const password = String(r.password || '').trim() || crypto.randomBytes(5).toString('base64url').slice(0, 8) + '#7'
      if (password.length < 8) { fail('Password must be 8+ characters'); continue }
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) { fail(error.message); continue }
      const id = data.user.id
      const p = await sb.from('profiles').insert({ id, role: 'student', full_name: name, email, phone: r.phone || null })
      const s = !p.error && await sb.from('students').insert({
        profile_id: id, class_id: cls.id, session_id: session?.id || null, guardian_name: r.guardian_name || null,
        guardian_phone: r.guardian_phone || null, address: r.address || null, admission_date: ad || new Date().toISOString().slice(0, 10)
      }).select('student_code').single()
      if (p.error || s.error) { await sb.auth.admin.deleteUser(id); fail((p.error || s.error).message); continue }
      results.push({ line, name, email, password, student_code: s.data.student_code, ok: true })
    }
    await audit(req, 'student.bulk_import', { created: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length })
    res.json({ results })
  })
}
