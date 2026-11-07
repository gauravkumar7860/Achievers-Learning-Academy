import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth, useLoad } from '../auth.jsx'
import { Empty, Loading, Page, fmt } from './ui.jsx'
import { useNavigate } from 'react-router-dom'

const useMe = () => useLoad(() => supabase.from('students').select('*, classes(name), academic_sessions(name)').maybeSingle().then(r => ({ data: r.data ? [r.data] : [] })), [])

export function Home() {
  const { profile } = useAuth(); const [me, loading] = useMe(); const s = me[0]
  const [ann] = useLoad(() => supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }).limit(3), [])
  return (<Page title={`Welcome, ${profile.full_name}`}>{loading ? <Loading /> : !s ? <Empty>Your student record is not set up yet. Please contact the academy.</Empty> :
    <div className="grid stats"><div className="card stat"><b>{s.student_code}</b><span>Student ID</span></div><div className="card stat"><b>{s.classes?.name || '—'}</b><span>Class</span></div>
      <div className="card stat"><b>{s.academic_sessions?.name || '—'}</b><span>Session</span></div><div className="card stat"><b style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</b><span>Status</span></div></div>}
    <h3>Latest Announcements</h3>{ann.length === 0 ? <Empty>No announcements.</Empty> : ann.map(a => <div className="card" key={a.id}><small>{a.category} • {fmt(a.created_at)}</small><h3>{a.title}</h3><p>{a.body}</p></div>)}</Page>)
}

export function Materials() {
  const [rows, loading] = useLoad(() => supabase.from('study_notes').select('*, subjects(name)').eq('published', true).order('created_at', { ascending: false }), [])
  const open = async n => { const { data, error } = await supabase.storage.from('study-notes').createSignedUrl(n.file_path, 120); error ? alert('Could not open file.') : window.open(data.signedUrl, '_blank') }
  return (<Page title="Study Material">{loading ? <Loading /> : rows.length === 0 ? <Empty>No study material has been shared yet.</Empty> : <div className="grid">{rows.map(n => <div className="card" key={n.id}>
    <small>{n.subjects?.name || 'General'} • {fmt(n.created_at)}</small><h3>{n.title}</h3><p>{n.description}</p>{n.file_path && <button className="btn sm" onClick={() => open(n)}>Download PDF</button>}</div>)}</div>}</Page>)
}

export function Announcements() {
  const [rows, loading] = useLoad(() => supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }), [])
  return (<Page title="Announcements">{loading ? <Loading /> : rows.length === 0 ? <Empty>No announcements.</Empty> : rows.map(a => <div className="card" key={a.id}><small>{a.category} • {fmt(a.created_at)}</small><h3>{a.title}</h3><p>{a.body}</p></div>)}</Page>)
}

export function Notifications() {
  const nav = useNavigate(); const { profile } = useAuth()
  const [rows, loading, reload] = useLoad(() => supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100), [])
  const open = async n => { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); if (n.link) nav(n.link); else reload() }
  const all = async () => { await supabase.from('notifications').update({ is_read: true }).eq('is_read', false).eq('profile_id', profile.id); reload() }
  return (<Page title="Notification History" action={<button className="btn ghost" onClick={all}>Mark all as read</button>}>{loading ? <Loading /> : rows.length === 0 ? <Empty>No notifications.</Empty> :
    rows.map(n => <button key={n.id} className={'card note-card ' + (n.is_read ? '' : 'unread')} onClick={() => open(n)}><b>{n.title}</b><span>{n.body}</span><small>{new Date(n.created_at).toLocaleString()}</small></button>)}</Page>)
}

export function Profile() {
  const { profile, reload } = useAuth(); const [me] = useMe(); const s = me[0]
  const [f, setF] = useState({ full_name: profile.full_name, phone: profile.phone || '' }); const [msg, setMsg] = useState('')
  const [pw, setPw] = useState('')
  const save = async e => { e.preventDefault(); const { error } = await supabase.from('profiles').update(f).eq('id', profile.id); setMsg(error ? error.message : 'Profile saved.'); reload() }
  const change = async e => { e.preventDefault(); if (pw.length < 8) return setMsg('Password must be 8+ characters.'); const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error ? error.message : 'Password changed.'); setPw('') }
  return (<Page title="My Profile"><form className="form card" onSubmit={save}>
    <label>Name<input value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></label><label>Phone<input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
    <label>Email<input disabled value={profile.email || ''} /></label><label>Student ID<input disabled value={s?.student_code || ''} /></label><button className="btn">Save</button></form>
    <form className="form card" onSubmit={change}><label>New password<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label><button className="btn">Change password</button></form>{msg && <p className="ok">{msg}</p>}</Page>)
}
