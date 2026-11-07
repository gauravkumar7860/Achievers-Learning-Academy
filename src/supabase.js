import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || 'http://localhost', import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing')

// Calls the secure server (privileged operations)
export async function api(path, { method = 'POST', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Request failed')
  return j
}
export const audit = (action, details) => supabase.from('audit_logs').insert({ action, details })
