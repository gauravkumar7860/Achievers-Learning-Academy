import { useState } from 'react'
import { supabase, api, audit } from '../supabase.js'
import { useLoad } from '../auth.jsx'
import { Empty, Loading, Page, confirmDo, fmt, Pager } from './ui.jsx'
import BulkImport from './bulk.jsx'

export function Dashboard() {
  const [stats, loading] = useLoad(async () => {
    const c = async (q) => (await q).count || 0
    const since = new Date(Date.now() - 30 * 864e5).toISOString()
    return { data: [{
      total: await c(supabase.from('students').select('*', { count: 'exact', head: true })),
      active: await c(supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active')),
      inactive: await c(supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'inactive')),
      fresh: await c(supabase.from('students').select('*', { count: 'exact', head: true }).gte('created_at', since)),
      enquiries: await c(supabase.from('admission_enquiries').select('*', { count: 'exact', head: true }).eq('status', 'new')),
    }] }
  }, [])
  const [logs] = useLoad(() => supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(6), [])
  const [fee] = useLoad(async () => {
    const t = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
    const rows = (await supabase.from('fee_invoices').select('balance,due_date').gt('balance', 0)).data || []
    const pays = (await supabase.from('fee_payments').select('amount').gte('paid_on', t.slice(0, 8) + '01')).data || []
    const add = l => l.reduce((n, r) => n + Number(r.balance ?? r.amount), 0)
    return { data: [{ pending: add(rows), collected: add(pays), due7: rows.filter(r => r.due_date >= t && r.due_date <= in7).length }] }
  }, [])
  const f = fee[0]
  const s = stats[0]
  return (<Page title="Dashboard">{loading || !s ? <Loading /> : <div className="grid stats">
    {[['Total students', s.total], ['Active', s.active], ['Inactive', s.inactive], ['New admissions (30 days)', s.fresh], ['New enquiries', s.enquiries]].map(([t, v]) => <div className="card stat" key={t}><b>{v}</b><span>{t}</span></div>)}</div>}
    {f && <div className="grid stats"><div className="card stat"><b>{'₹' + f.collected.toLocaleString('en-IN')}</b><span>Fees collected this month</span></div><div className="card stat"><b>{'₹' + f.pending.toLocaleString('en-IN')}</b><span>Pending fees</span></div><div className="card stat"><b>{f.due7}</b><span>Fee due dates in next 7 days</span></div></div>}
    <h3>Recent Activity</h3><div className="card">{logs.length === 0 ? <Empty>No activity yet.</Empty> : logs.map(l => <p key={l.id} className="row"><b>{l.action}</b><small>{new Date(l.created_at).toLocaleString()}</small></p>)}</div></Page>)
}

const SIZE = 10
export function Students() {
  const [q, setQ] = useState(''); const [cls, setCls] = useState(''); const [page, setPage] = useState(0); const [show, setShow] = useState(false); const [bulk, setBulk] = useState(false); const [edit, setEdit] = useState(null); const [eerr, setEerr] = useState('')
  const [classes] = useLoad(() => supabase.from('classes').select('*').order('sort_order'), [])
  const [sessions] = useLoad(() => supabase.from('academic_sessions').select('*'), [])
  const [rows, loading, reload, total] = useLoad(() => {
    let x = supabase.from('students').select('*, profiles!inner(full_name,email,phone), classes(name)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1)
    if (q) x = x.or(`full_name.ilike.%${q}%`, { foreignTable: 'profiles' })
    if (cls) x = x.eq('class_id', cls)
    return x
  }, [q, cls, page])
  const blank = { full_name: '', email: '', password: '', phone: '', class_id: '', session_id: '', guardian_name: '', guardian_phone: '', address: '', admission_date: new Date().toISOString().slice(0, 10) }
  const [f, setF] = useState(blank); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const add = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await api('/api/admin/students', { body: f }); setF(blank); setShow(false); reload() } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  const startEdit = s => { setShow(false); setEerr(''); setEdit({ id: s.id, profile_id: s.profile_id, code: s.student_code, email: s.profiles.email, full_name: s.profiles.full_name, phone: s.profiles.phone || '', class_id: s.class_id || '', session_id: s.session_id || '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '', address: s.address || '', admission_date: s.admission_date || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const setE = k => e => setEdit({ ...edit, [k]: e.target.value })
  const saveEdit = async e => {
    e.preventDefault(); setEerr('')
    const p = await supabase.from('profiles').update({ full_name: edit.full_name, phone: edit.phone || null }).eq('id', edit.profile_id)
    const st = await supabase.from('students').update({ class_id: edit.class_id || null, session_id: edit.session_id || null, guardian_name: edit.guardian_name || null, guardian_phone: edit.guardian_phone || null, address: edit.address || null, admission_date: edit.admission_date || null }).eq('id', edit.id)
    if (p.error || st.error) return setEerr((p.error || st.error).message)
    await audit('student.edit', { code: edit.code }); setEdit(null); reload()
  }
  const setStatus = async (s, status) => { await supabase.from('students').update({ status }).eq('id', s.id); await audit('student.status', { code: s.student_code, status }); reload() }
  const remove = s => confirmDo(`Permanently delete ${s.profiles.full_name}? This cannot be undone.`, async () => { try { await api(`/api/admin/students/${s.profile_id}`, { method: 'DELETE' }); reload() } catch (x) { alert(x.message) } })
  const reset = async s => { const pw = prompt('New password (8+ characters):'); if (!pw) return; try { await api(`/api/admin/students/${s.profile_id}/password`, { body: { password: pw } }); alert('Password updated.') } catch (x) { alert(x.message) } }
  return (<Page title="Students" action={<span><button className="btn ghost" onClick={() => setBulk(!bulk)}>{bulk ? 'Close Import' : 'Bulk Import'}</button> <button className="btn" onClick={() => setShow(!show)}>{show ? 'Close' : '+ Add Student'}</button></span>}>
    {bulk && <BulkImport onDone={reload} />}
    {show && <form className="form card" onSubmit={add}>
      <label>Full name<input required value={f.full_name} onChange={set('full_name')} /></label>
      <label>Login email<input type="email" required value={f.email} onChange={set('email')} /></label>
      <label>Temporary password<input required minLength="8" value={f.password} onChange={set('password')} /></label>
      <label>Student phone<input value={f.phone} onChange={set('phone')} /></label>
      <label>Class<select required value={f.class_id} onChange={set('class_id')}><option value="">Select…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Session<select value={f.session_id} onChange={set('session_id')}><option value="">Select…</option>{sessions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Parent/guardian<input value={f.guardian_name} onChange={set('guardian_name')} /></label>
      <label>Guardian phone<input value={f.guardian_phone} onChange={set('guardian_phone')} /></label>
      <label>Admission date<input type="date" value={f.admission_date} onChange={set('admission_date')} /></label>
      <label>Address<input value={f.address} onChange={set('address')} /></label>
      {err && <p className="error full">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create Student'}</button></form>}
    {edit && <form className="form card" onSubmit={saveEdit}>
      <h3 className="full">Edit student {edit.code}</h3>
      <label>Full name<input required value={edit.full_name} onChange={setE('full_name')} /></label>
      <label>Login email (cannot be changed here)<input disabled value={edit.email || ''} /></label>
      <label>Student phone<input value={edit.phone} onChange={setE('phone')} /></label>
      <label>Class<select required value={edit.class_id} onChange={setE('class_id')}><option value="">Select…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Session<select value={edit.session_id} onChange={setE('session_id')}><option value="">Select…</option>{sessions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Parent/guardian<input value={edit.guardian_name} onChange={setE('guardian_name')} /></label>
      <label>Guardian phone<input value={edit.guardian_phone} onChange={setE('guardian_phone')} /></label>
      <label>Admission date<input type="date" value={edit.admission_date} onChange={setE('admission_date')} /></label>
      <label>Address<input value={edit.address} onChange={setE('address')} /></label>
      {eerr && <p className="error full">{eerr}</p>}
      <span><button className="btn">Save changes</button> <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></span></form>}
    <div className="filters"><input placeholder="Search by name…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
      <select value={cls} onChange={e => { setCls(e.target.value); setPage(0) }}><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No students found.</Empty> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Guardian</th><th>Admitted</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(s => <tr key={s.id}><td>{s.student_code}</td><td>{s.profiles.full_name}<br /><small>{s.profiles.email}</small></td><td>{s.classes?.name || '—'}</td><td>{s.guardian_name || '—'}<br /><small>{s.guardian_phone}</small></td><td>{fmt(s.admission_date)}</td>
        <td><select value={s.status} onChange={e => setStatus(s, e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option></select></td>
        <td className="actions"><button className="link" onClick={() => startEdit(s)}>Edit</button><button className="link" onClick={() => reset(s)}>Reset password</button><button className="link danger" onClick={() => remove(s)}>Delete</button></td></tr>)}</tbody></table></div>}
    <Pager page={page} setPage={setPage} total={total} size={SIZE} /></Page>)
}

export function Classes() {
  const [classes, , reloadC] = useLoad(() => supabase.from('classes').select('*, subjects(id,name)').order('sort_order'), [])
  const [name, setName] = useState(''); const [sub, setSub] = useState({})
  const addClass = async e => { e.preventDefault(); await supabase.from('classes').insert({ name, sort_order: classes.length }); setName(''); reloadC() }
  const rename = async c => { const n = prompt('Class name', c.name); if (n) { await supabase.from('classes').update({ name: n }).eq('id', c.id); reloadC() } }
  const delClass = c => confirmDo(`Delete ${c.name} and its subjects?`, async () => { const { error } = await supabase.from('classes').delete().eq('id', c.id); if (error) alert('Cannot delete: students are assigned to this class.'); reloadC() })
  const addSub = async (c, e) => { e.preventDefault(); if (!sub[c.id]) return; await supabase.from('subjects').insert({ class_id: c.id, name: sub[c.id] }); setSub({ ...sub, [c.id]: '' }); reloadC() }
  const delSub = s => confirmDo(`Remove subject ${s.name}?`, async () => { await supabase.from('subjects').delete().eq('id', s.id); reloadC() })
  return (<Page title="Classes & Subjects"><form className="inline" onSubmit={addClass}><input required placeholder="New class name" value={name} onChange={e => setName(e.target.value)} /><button className="btn">Add Class</button></form>
    <div className="grid">{classes.map(c => <div className="card" key={c.id}><div className="row"><h3>{c.name}</h3><span><button className="link" onClick={() => rename(c)}>Edit</button><button className="link danger" onClick={() => delClass(c)}>Delete</button></span></div>
      {c.subjects.length === 0 && <Empty>No subjects.</Empty>}{c.subjects.map(s => <p className="row" key={s.id}>{s.name}<button className="link danger" onClick={() => delSub(s)}>✕</button></p>)}
      <form className="inline" onSubmit={e => addSub(c, e)}><input placeholder="Add subject" value={sub[c.id] || ''} onChange={e => setSub({ ...sub, [c.id]: e.target.value })} /><button className="btn sm">Add</button></form></div>)}</div></Page>)
}

export function Materials() {
  const [classes] = useLoad(() => supabase.from('classes').select('*, subjects(id,name)').order('sort_order'), [])
  const [rows, loading, reload] = useLoad(() => supabase.from('study_notes').select('*, classes(name), subjects(name)').order('created_at', { ascending: false }), [])
  const blank = { title: '', description: '', class_id: '', subject_id: '' }; const [f, setF] = useState(blank); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const subjects = classes.find(c => c.id === f.class_id)?.subjects || []
  const add = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    let path = null
    if (file) {
      if (file.type !== 'application/pdf') { setErr('Only PDF files are allowed.'); setBusy(false); return }
      path = `${f.class_id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const up = await supabase.storage.from('study-notes').upload(path, file)
      if (up.error) { setErr(up.error.message); setBusy(false); return }
    }
    const { error } = await supabase.from('study_notes').insert({ ...f, subject_id: f.subject_id || null, file_path: path, published: false })
    if (error) setErr(error.message); else { await audit('material.create', { title: f.title }); setF(blank); setFile(null); e.target.reset(); reload() }
    setBusy(false)
  }
  const toggle = async n => { await supabase.from('study_notes').update({ published: !n.published }).eq('id', n.id); await audit(n.published ? 'material.unpublish' : 'material.publish', { title: n.title }); reload() }
  const del = n => confirmDo(`Delete "${n.title}"?`, async () => { if (n.file_path) await supabase.storage.from('study-notes').remove([n.file_path]); await supabase.from('study_notes').delete().eq('id', n.id); reload() })
  return (<Page title="Study Material"><form className="form card" onSubmit={add}>
    <label>Title<input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
    <label>Class<select required value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value, subject_id: '' })}><option value="">Select…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Subject<select value={f.subject_id} onChange={e => setF({ ...f, subject_id: e.target.value })}><option value="">—</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>PDF file<input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} /></label>
    <label className="full">Description<textarea rows="2" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
    {err && <p className="error full">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload (saved as unpublished)'}</button></form>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No materials uploaded.</Empty> : <div className="table-wrap"><table><thead><tr><th>Title</th><th>Class</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(n => <tr key={n.id}><td>{n.title}</td><td>{n.classes?.name}</td><td>{n.subjects?.name || '—'}</td><td>{n.published ? 'Published' : 'Draft'}</td>
        <td className="actions"><button className="link" onClick={() => toggle(n)}>{n.published ? 'Unpublish' : 'Publish'}</button><button className="link danger" onClick={() => del(n)}>Delete</button></td></tr>)}</tbody></table></div>}</Page>)
}

export function Announcements() {
  const [rows, loading, reload] = useLoad(() => supabase.from('announcements').select('*').order('created_at', { ascending: false }), [])
  const blank = { title: '', body: '', category: 'General' }; const [f, setF] = useState(blank)
  const cats = ['General', 'Holiday', 'Examination Schedule', 'Test', 'Admission Update', 'Academic']
  const add = async e => { e.preventDefault(); await supabase.from('announcements').insert({ ...f, published: true }); await audit('announcement.publish', { title: f.title }); setF(blank); reload() }
  const toggle = async a => { await supabase.from('announcements').update({ published: !a.published }).eq('id', a.id); reload() }
  const edit = async a => { const t = prompt('Title', a.title); if (t) { await supabase.from('announcements').update({ title: t }).eq('id', a.id); reload() } }
  const del = a => confirmDo(`Delete "${a.title}"?`, async () => { await supabase.from('announcements').delete().eq('id', a.id); reload() })
  return (<Page title="Announcements"><form className="form card" onSubmit={add}>
    <label>Title<input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
    <label>Category<select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="full">Message<textarea required rows="3" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></label><button className="btn">Publish (students are notified)</button></form>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No announcements.</Empty> : rows.map(a => <div className="card" key={a.id}><div className="row"><small>{a.category} • {fmt(a.created_at)} • {a.published ? 'Published' : 'Hidden'}</small>
      <span><button className="link" onClick={() => edit(a)}>Edit</button><button className="link" onClick={() => toggle(a)}>{a.published ? 'Hide' : 'Show'}</button><button className="link danger" onClick={() => del(a)}>Delete</button></span></div><h3>{a.title}</h3><p>{a.body}</p></div>)}</Page>)
}

export function Admissions() {
  const [rows, loading, reload] = useLoad(() => supabase.from('admission_enquiries').select('*').order('created_at', { ascending: false }), [])
  const set = async (r, status) => { await supabase.from('admission_enquiries').update({ status }).eq('id', r.id); reload() }
  const del = r => confirmDo(`Delete enquiry for ${r.student_name}?`, async () => { await supabase.from('admission_enquiries').delete().eq('id', r.id); reload() })
  return (<Page title="Admission Enquiries">{loading ? <Loading /> : rows.length === 0 ? <Empty>No enquiries yet.</Empty> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Guardian / Phone</th><th>Class</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody>
    {rows.map(r => <tr key={r.id}><td>{fmt(r.created_at)}</td><td>{r.student_name}</td><td>{r.guardian_name}<br /><small>{r.phone}</small></td><td>{r.class_applying}</td><td><small>{[r.previous_school, r.address, r.notes].filter(Boolean).join(' • ')}</small></td>
      <td><select value={r.status} onChange={e => set(r, e.target.value)}>{['new', 'contacted', 'admitted', 'closed'].map(s => <option key={s}>{s}</option>)}</select></td><td><button className="link danger" onClick={() => del(r)}>Delete</button></td></tr>)}</tbody></table></div>}</Page>)
}

export function Activity() {
  const [rows, loading] = useLoad(() => supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100), [])
  return (<Page title="Activity Log">{loading ? <Loading /> : rows.length === 0 ? <Empty>No activity recorded.</Empty> : <div className="card">{rows.map(l => <p className="row" key={l.id}><span><b>{l.action}</b> <small>{l.details ? JSON.stringify(l.details) : ''}</small></span><small>{new Date(l.created_at).toLocaleString()}</small></p>)}</div>}</Page>)
}
