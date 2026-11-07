import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async (session) => {
    if (!session) { setProfile(null); setLoading(false); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfile(data); setLoading(false)
  }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s))
    return () => sub.subscription.unsubscribe()
  }, [load])
  const signOut = () => supabase.auth.signOut()
  return <Ctx.Provider value={{ profile, loading, signOut, reload: async () => load((await supabase.auth.getSession()).data.session) }}>{children}</Ctx.Provider>
}

export function RequireRole({ role, children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="center">Loading…</div>
  if (!profile) return <Navigate to={role === 'admin' ? '/admin-login' : '/login'} replace />
  if (profile.role !== role) return <Navigate to="/" replace />
  return children
}

// tiny data hook: const [rows, loading, reload] = useLoad(() => supabase.from(...), [deps])
export function useLoad(fn, deps = []) {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true); const [count, setCount] = useState(0)
  const run = useCallback(async () => { setLoading(true); const r = await fn(); setData(r.data || []); setCount(r.count || 0); setLoading(false) }, deps) // eslint-disable-line
  useEffect(() => { run() }, [run])
  return [data, loading, run, count]
}
