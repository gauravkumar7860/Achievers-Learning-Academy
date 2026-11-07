import { useState } from 'react'
import { api } from '../supabase.js'

const COLS = ['full_name', 'email', 'phone', 'class', 'guardian_name', 'guardian_phone', 'address', 'admission_date', 'password']

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row)
  return rows
}
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click() }
const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

export default function BulkImport({ onDone }) {
  const [rows, setRows] = useState([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [results, setResults] = useState(null)
  const template = () => download('students-template.csv', COLS.join(',') + '\nAarav Sharma,aarav@example.com,9876543210,6th,Mr. Sharma,9876500000,Village Birh Kathgarh,2026-08-01,\n')
  const onFile = async e => {
    setErr(''); setResults(null); setRows([])
    const f = e.target.files[0]; if (!f) return
    const t = await f.text(); const parsed = parseCSV(t.replace(/^\uFEFF/, ''))
    const head = parsed[0].map(h => h.trim().toLowerCase())
    if (!head.includes('full_name') || !head.includes('email') || !head.includes('class')) return setErr('The file needs the columns full_name, email and class. Download the template.')
    const list = parsed.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
    if (list.length === 0) return setErr('The file has no students.')
    if (list.length > 200) return setErr('Please import at most 200 students at a time.')
    setRows(list)
  }
  const run = async () => {
    setBusy(true); setErr('')
    try { const r = await api('/api/admin/students/bulk', { body: { rows } }); setResults(r.results); setRows([]); onDone() } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  const creds = () => download('student-logins.csv', 'student_id,name,email,password\n' + results.filter(r => r.ok).map(r => [r.student_code, r.name, r.email, r.password].map(esc).join(',')).join('\n'))
  const ok = results?.filter(r => r.ok).length, bad = results?.filter(r => !r.ok)
  return (<div className="card"><h3>Bulk Import (CSV)</h3>
    <p className="muted small">Columns: <code>{COLS.join(', ')}</code>. Required: full_name, email, class (exact class name). Leave <code>password</code> empty to auto-generate. In Excel use Save As → CSV.</p>
    <p><button className="btn ghost sm" onClick={template}>Download template</button></p>
    <input type="file" accept=".csv,text/csv" onChange={onFile} />
    {err && <p className="error">{err}</p>}
    {rows.length > 0 && <><p><b>{rows.length}</b> students ready to import.</p>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Class</th></tr></thead><tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}><td>{r.full_name}</td><td>{r.email}</td><td>{r.class}</td></tr>)}</tbody></table></div>
      {rows.length > 5 && <p className="muted small">…and {rows.length - 5} more</p>}
      <button className="btn" disabled={busy} onClick={run}>{busy ? 'Importing… please wait' : `Import ${rows.length} students`}</button></>}
    {results && <><p className="ok"><b>{ok}</b> students created{bad.length > 0 && <span className="error">, {bad.length} failed</span>}.</p>
      {ok > 0 && <p><button className="btn sm" onClick={creds}>Download login details (CSV)</button> <span className="muted small">Passwords are shown only now, so download this file.</span></p>}
      {bad.length > 0 && <div className="table-wrap"><table><thead><tr><th>Row</th><th>Name</th><th>Problem</th></tr></thead><tbody>{bad.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.name}</td><td className="error">{r.error}</td></tr>)}</tbody></table></div>}</>}
  </div>)
}
