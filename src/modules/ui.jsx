export const Empty = ({ children = 'Nothing here yet.' }) => <p className="muted pad">{children}</p>
export const Loading = () => <p className="muted pad">Loading…</p>
export const Page = ({ title, action, children }) => <><div className="page-head"><h2>{title}</h2>{action}</div>{children}</>
export const confirmDo = (msg, fn) => { if (window.confirm(msg)) fn() }
export const fmt = d => d ? new Date(d).toLocaleDateString() : '—'
export const Pager = ({ page, setPage, total, size }) => (
  <div className="pager"><button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
    <span>Page {page + 1} of {Math.max(1, Math.ceil(total / size))}</span>
    <button className="btn ghost sm" disabled={(page + 1) * size >= total} onClick={() => setPage(page + 1)}>Next</button></div>)
