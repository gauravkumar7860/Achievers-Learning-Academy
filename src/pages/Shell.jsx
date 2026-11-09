import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { supabase } from '../supabase.js'
import { fdt } from '../modules/ui.jsx'

function Bell() {
  const { profile } = useAuth(); const nav = useNavigate()
  const [items, setItems] = useState([]); const [open, setOpen] = useState(false); const [toast, setToast] = useState(null)
  const load = async () => { const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30); setItems(data || []) }
  useEffect(() => {
    load()
    const ch = supabase.channel('notif-' + profile.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profile.id}` },
      p => { setToast(p.new); load(); setTimeout(() => setToast(null), 6000) }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  const unread = items.filter(i => !i.is_read).length
  const go = async n => { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); setOpen(false); setToast(null); load(); if (n.link) nav(n.link) }
  const readAll = async () => { await supabase.from('notifications').update({ is_read: true }).eq('is_read', false).eq('profile_id', profile.id); load() }
  return (<>
    <div className="bell"><button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Notifications">🔔{unread > 0 && <span className="badge">{unread}</span>}</button>
      {open && <div className="dropdown"><div className="dd-head"><b>Notifications</b><button className="link" onClick={readAll}>Mark all read</button></div>
        {items.length === 0 && <p className="muted pad">No notifications yet.</p>}
        {items.slice(0, 8).map(n => <button key={n.id} className={'note ' + (n.is_read ? '' : 'unread')} onClick={() => go(n)}><b>{n.title}</b><small>{fdt(n.created_at)}</small></button>)}
        <button className="link pad" onClick={() => { setOpen(false); nav('/student/notifications') }}>View all</button></div>}
    </div>
    {toast && <button className="toast" onClick={() => go(toast)}><b>{toast.title}</b><small>Tap to open</small></button>}
  </>)
}

export default function Shell({ title, modules, base, bell }) {
  const { profile, signOut } = useAuth(); const [menu, setMenu] = useState(false)
  return (
    <div className="shell">
      <aside className={menu ? 'side open' : 'side'}>
        <div className="brand"><img src="/logo.png" alt="" /><span>Achievers<br /><small>{title} Portal</small></span></div>
        <nav>{modules.map(m => <NavLink key={m.path} end={m.path === ''} to={`${base}/${m.path}`} onClick={() => setMenu(false)}><i>{m.icon}</i>{m.label}</NavLink>)}</nav>
      </aside>
      <div className="main">
        <header className="topbar"><button className="icon-btn hamburger" onClick={() => setMenu(!menu)}>☰</button><span className="grow" />
          {bell && <Bell />}<span className="who">{profile.full_name}</span><button className="btn ghost" onClick={signOut}>Logout</button></header>
        <section className="content"><Outlet /></section>
      </div>
    </div>
  )
}
