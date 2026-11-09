import { useState, useEffect, useRef } from 'react'
export const Empty = ({ children = 'Nothing here yet.' }) => <p className="muted pad">{children}</p>
export const Loading = () => <p className="muted pad">Loading…</p>
export const Page = ({ title, action, children }) => <><div className="page-head"><h2>{title}</h2>{action}</div>{children}</>
export const confirmDo = (msg, fn) => { if (window.confirm(msg)) fn() }
const p2 = n => String(n).padStart(2, '0')
export const fmt = d => { if (!d) return '—'; if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`; const x = new Date(d); return `${p2(x.getDate())}/${p2(x.getMonth() + 1)}/${x.getFullYear()}` }
export const fdt = d => { if (!d) return '—'; const x = new Date(d); return `${fmt(d)}, ${p2(x.getHours())}:${p2(x.getMinutes())}` }
const parseDMY = t => { const m = t.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (!m) return ''; const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); return dt.getUTCDate() === +m[1] && dt.getUTCMonth() === +m[2] - 1 ? `${m[3]}-${p2(m[2])}-${p2(m[1])}` : '' }
const showDMY = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '')
// Date box that always uses DD/MM/YYYY. value/onChange use YYYY-MM-DD ('' while invalid).
export function DateInput({ value, onChange, required, disabled }) {
  const [t, setT] = useState(showDMY(value)); const ref = useRef(null)
  useEffect(() => { if (parseDMY(t) !== (value || '')) setT(showDMY(value)) }, [value]) // eslint-disable-line
  useEffect(() => { ref.current?.setCustomValidity(t && !parseDMY(t) ? 'Enter a real date as DD/MM/YYYY' : '') }, [t])
  return <input ref={ref} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} required={required} disabled={disabled} value={t} onChange={e => { setT(e.target.value); onChange(parseDMY(e.target.value)) }} />
}
export const Pager = ({ page, setPage, total, size }) => (
  <div className="pager"><button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
    <span>Page {page + 1} of {Math.max(1, Math.ceil(total / size))}</span>
    <button className="btn ghost sm" disabled={(page + 1) * size >= total} onClick={() => setPage(page + 1)}>Next</button></div>)
