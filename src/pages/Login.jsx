import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase.js'

export function Login({ role }) {
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword(f)
    if (error) { setErr(error.message); setBusy(false); return }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (p?.role !== role) { await supabase.auth.signOut(); setErr(`This account is not a ${role} account.`); setBusy(false); return }
    nav(role === 'admin' ? '/admin' : '/student')
  }
  const forgot = async () => {
    if (!f.email) return setErr('Enter your email first, then click Forgot password.')
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + '/reset' })
    error ? setErr(error.message) : setMsg('Password reset link sent. Check your email.')
  }
  return (
    <div className="auth-card"><img src="/logo.png" alt="Achievers Learning Academy" className="auth-logo" />
      <h2>{role === 'admin' ? 'Admin Login' : 'Student Login'}</h2>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
        {err && <p className="error">{err}</p>}{msg && <p className="ok">{msg}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
      </form>
      <button className="link" onClick={forgot}>Forgot password?</button>
      <p className="muted small">{role === 'admin' ? <Link to="/login">Student login</Link> : <>Accounts are created by the academy. <Link to="/admin-login">Admin login</Link></>}</p>
    </div>
  )
}

export function Reset() {
  const nav = useNavigate(); const [pw, setPw] = useState(''); const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setErr(error.message)
    await supabase.auth.signOut(); nav('/login')
  }
  return (<div className="auth-card"><h2>Set a new password</h2><form onSubmit={submit}>
    <label>New password<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
    {err && <p className="error">{err}</p>}<button className="btn">Update password</button></form></div>)
}
