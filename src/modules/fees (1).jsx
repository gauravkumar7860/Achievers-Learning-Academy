import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'
import { useLoad } from '../auth.jsx'
import { Empty, Loading, Page, Pager, DateInput, ActionMenu } from './ui.jsx'
import { money, today, daysBetween, addDays, dmy, gapAmount, nextDue, downloadCSV, receiptPDF, tablePDF, RECEIPT_SELECT, METHODS, METHOD_OPTIONS, parseCSV, toISO, ord } from './feeutil.js'

const Chip = ({ i }) => { const s = Number(i.balance) > 0 && i.due_date < today() ? 'overdue' : i.status; return <span className={'chip ' + s}>{s}</span> }
const periodLabel = i => (i.kind === 'gap' ? 'Gap fee ' : '') + `${dmy(i.period_start)} – ${dmy(i.period_end)}`
const sum = (rows, f) => rows.reduce((s, r) => s + Number(f(r) || 0), 0)
const one = x => (Array.isArray(x) ? x[0] : x)

/* ---------- shared: one student's invoices + payments (used by admin and student) ---------- */
export function FeeHistory({ studentId }) {
  const [inv, l1] = useLoad(() => supabase.from('fee_invoices').select('*').eq('student_id', studentId).lte('period_start', today()).order('period_start', { ascending: true }), [studentId])
  const [pay, l2] = useLoad(() => supabase.from('fee_payments').select(RECEIPT_SELECT).eq('student_id', studentId).order('created_at', { ascending: false }), [studentId])
  if (l1 || l2) return <Loading />
  const pending = inv.filter(i => Number(i.balance) > 0), nxt = [...pending].sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
  return (<>
    <div className="grid stats"><div className="card stat"><b>{money(sum(pending, i => i.balance))}</b><span>Pending fee</span></div>
      <div className="card stat"><b>{nxt ? dmy(nxt.due_date) : '—'}</b><span>Next due date</span></div>
      <div className="card stat"><b>{money(sum(pay, p => p.amount))}</b><span>Total paid</span></div></div>
    <h3>Month-wise fees</h3>
    {inv.length === 0 ? <Empty>No fee months yet.</Empty> : <div className="table-wrap"><table><thead><tr><th>Month</th><th>Period</th><th>Fee</th><th>Adjust.</th><th>Balance</th><th>Status</th></tr></thead><tbody>
      {inv.map(i => { const d = pay.filter(p => p.invoice_id === i.id).map(p => p.paid_on).sort().pop(); return <tr key={i.id}><td>{i.kind === 'gap' ? 'Gap fee' : ord(i.period_no) + ' month'}</td><td>{dmy(i.period_start)} – {dmy(i.period_end)}</td><td>{money(i.amount)}</td><td>{money(i.adj_total)}</td><td><b>{money(i.balance)}</b></td>
        <td>{Number(i.balance) <= 0 ? <span className="chip paid">PAID{d ? ` (${dmy(d)})` : ''}</span> : <><Chip i={i} /> <small>due {dmy(i.due_date)}</small></>}</td></tr> })}</tbody></table></div>}
    <h3>Payment history</h3>
    {pay.length === 0 ? <Empty>No payments recorded.</Empty> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Receipt</th><th>Period</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>
      {pay.map(p => <tr key={p.id}><td>{dmy(p.paid_on)}</td><td>{p.receipt_no}</td><td>{p.fee_invoices && periodLabel(p.fee_invoices)}</td><td>{METHODS[p.method]}{p.reference && <><br /><small>{p.reference}</small></>}</td><td>{money(p.amount)}</td>
        <td><button className="link" onClick={() => receiptPDF(p)}>Receipt PDF</button></td></tr>)}</tbody></table></div>}
  </>)
}

/* ---------- student: My Fees ---------- */
export function MyFees() {
  const [me, loading] = useLoad(() => supabase.from('students').select('id').maybeSingle().then(r => ({ data: r.data ? [r.data] : [] })), [])
  const [ready, setReady] = useState(false)
  useEffect(() => { if (me[0]) supabase.rpc('generate_invoices', { p_student: me[0].id }).then(() => setReady(true)) }, [me])
  return (<Page title="My Fees">{loading ? <Loading /> : !me[0] ? <Empty>Your student record is not set up yet.</Empty> : !ready ? <Loading /> : <FeeHistory studentId={me[0].id} />}</Page>)
}

/* ---------- admin: fee register (like the paper register) ---------- */
function MonthCell({ i, name, onPay, onAdj }) {
  if (!i) return <td className="rc muted">—</td>
  const paidOn = (i.fee_payments || []).map(p => p.paid_on).sort().pop(), bal = Number(i.balance), over = bal > 0 && i.due_date < today()
  return (<td className={'rc ' + (bal <= 0 ? 'paid' : over ? 'overdue' : i.status)}><small>{dmy(i.period_start)} – {dmy(i.period_end)}</small>
    {bal <= 0 ? <b>PAID{paidOn ? ` (${dmy(paidOn)})` : ''}</b> : <><b>{over ? 'OVERDUE' : i.status === 'partial' ? 'PARTIAL' : 'PENDING'} {money(bal)}</b><small>due {dmy(i.due_date)}</small>
      <ActionMenu items={[{ label: 'Collect payment', onClick: () => onPay({ ...i, name }) }, { label: 'Discount / adjustment', onClick: () => onAdj({ ...i, name }) }]} /></>}</td>)
}

export function Fees() {
  const [q, setQ] = useState(''); const [cls, setCls] = useState(''); const [page, setPage] = useState(0); const [SIZE, setSize] = useState(10); const [tick, setTick] = useState(0)
  const [syncMsg, setSyncMsg] = useState(''); const [pay, setPay] = useState(null); const [adj, setAdj] = useState(null); const [done, setDone] = useState(null)
  const [pf, setPf] = useState({}); const [af, setAf] = useState({ kind: 'discount', amount: '', reason: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const bump = () => setTick(t => t + 1)
  const sync = async () => { const { data, error } = await supabase.rpc('generate_invoices', { p_student: null }); setSyncMsg(error ? error.message : data > 0 ? `${data} new month(s) added.` : 'Everything is up to date.'); bump() }
  useEffect(() => { sync() }, []) // eslint-disable-line
  const [classes] = useLoad(() => supabase.from('classes').select('*').order('sort_order'), [])
  const [stats] = useLoad(async () => {
    const t = today(), inv = (await supabase.from('fee_invoices').select('balance,due_date').gt('balance', 0)).data || []
    const pays = (await supabase.from('fee_payments').select('amount').gte('paid_on', t.slice(0, 8) + '01')).data || []
    return { data: [{ pending: sum(inv, r => r.balance), overdue: sum(inv.filter(r => r.due_date < t), r => r.balance), due7: inv.filter(r => r.due_date >= t && r.due_date <= addDays(t, 7)).length, month: sum(pays, r => r.amount) }] }
  }, [tick])
  const [rows, loading, , total] = useLoad(() => {
    let x = supabase.from('students').select('id, student_code, status, admission_date, classes(name), profiles!inner(full_name), fee_accounts(*), fee_invoices(*, fee_payments(paid_on,amount))', { count: 'exact' })
      .lte('fee_invoices.period_start', today()).order('created_at', { ascending: true }).range(page * SIZE, page * SIZE + SIZE - 1)
    if (q) x = x.ilike('profiles.full_name', `%${q}%`)
    if (cls) x = x.eq('class_id', cls)
    return x
  }, [q, cls, page, SIZE, tick])
  const s = stats[0]
  const list = rows.map(st => { const inv = [...(st.fee_invoices || [])].sort((a, b) => a.period_start.localeCompare(b.period_start)); return { st, acc: one(st.fee_accounts), cyc: inv.filter(i => i.kind === 'cycle'), gaps: inv.filter(i => i.kind === 'gap') } })
  const cols = Math.max(1, ...list.map(r => r.cyc.length)), hasGap = list.some(r => r.gaps.length)
  const openPay = i => { setAdj(null); setDone(null); setErr(''); setPay(i); setPf({ amount: i.balance, method: 'cash', paid_on: today(), reference: '' }) }
  const openAdj = i => { setPay(null); setDone(null); setErr(''); setAdj(i); setAf({ kind: 'discount', amount: '', reason: '' }) }
  const submitPay = async e => {
    e.preventDefault(); setErr(''); const amt = Number(pf.amount)
    if (!(amt > 0) || amt > Number(pay.balance)) return setErr(`Enter an amount between 0.01 and ${money(pay.balance)}.`)
    if (!pf.paid_on) return setErr('Enter the payment date as DD/MM/YYYY.')
    setBusy(true)
    const { data, error } = await supabase.from('fee_payments').insert({ invoice_id: pay.id, student_id: pay.student_id, amount: amt, method: pf.method, paid_on: pf.paid_on, reference: pf.reference || null }).select('id, receipt_no').single()
    setBusy(false); if (error) return setErr(error.message)
    setPay(null); setDone(data); bump()
  }
  const submitAdj = async e => {
    e.preventDefault(); setErr(''); const amt = Number(af.amount)
    if (!(amt > 0)) return setErr('Enter an amount greater than 0.')
    setBusy(true)
    const { error } = await supabase.from('fee_adjustments').insert({ invoice_id: adj.id, student_id: adj.student_id, amount: af.kind === 'discount' ? -amt : amt, reason: af.reason })
    setBusy(false); if (error) return setErr(error.message)
    setAdj(null); bump()
  }
  const getReceipt = async id => { const { data, error } = await supabase.from('fee_payments').select(RECEIPT_SELECT).eq('id', id).single(); error ? alert(error.message) : receiptPDF(data) }
  return (<Page title="Fee Register" action={<button className="btn ghost" onClick={sync}>Refresh months</button>}>
    <p className="muted small">Today is {dmy(today())}. Each student's months run in fixed 31-day cycles from the date of joining; only months that have started are shown. {syncMsg}</p>
    {s && <div className="grid stats"><div className="card stat"><b>{money(s.pending)}</b><span>Pending fees</span></div><div className="card stat"><b>{money(s.overdue)}</b><span>Overdue</span></div>
      <div className="card stat"><b>{s.due7}</b><span>Months due in 7 days</span></div><div className="card stat"><b>{money(s.month)}</b><span>Collected this month</span></div></div>}
    {done && <div className="card ok-card"><b>Payment recorded.</b> Receipt {done.receipt_no} <button className="btn sm" onClick={() => getReceipt(done.id)}>Download receipt PDF</button></div>}
    {pay && <form className="form card" onSubmit={submitPay}><h3 className="full">Collect payment — {pay.name} ({periodLabel(pay)}), balance {money(pay.balance)}</h3>
      <label>Amount (₹)<input type="number" step="0.01" required value={pf.amount} onChange={e => setPf({ ...pf, amount: e.target.value })} /></label>
      <label>Method<select value={pf.method} onChange={e => setPf({ ...pf, method: e.target.value })}>{METHOD_OPTIONS.map(k => <option key={k} value={k}>{METHODS[k]}</option>)}</select></label>
      <label>Payment date<DateInput required value={pf.paid_on} onChange={v => setPf({ ...pf, paid_on: v })} /></label>
      <label>Transaction reference<input value={pf.reference} onChange={e => setPf({ ...pf, reference: e.target.value })} /></label>
      {err && <p className="error full">{err}</p>}<span><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button> <button type="button" className="btn ghost" onClick={() => setPay(null)}>Cancel</button></span></form>}
    {adj && <form className="form card" onSubmit={submitAdj}><h3 className="full">Discount / adjustment — {adj.name} ({periodLabel(adj)}), balance {money(adj.balance)}</h3>
      <label>Type<select value={af.kind} onChange={e => setAf({ ...af, kind: e.target.value })}><option value="discount">Discount (reduces fee)</option><option value="charge">Extra charge (adds to fee)</option></select></label>
      <label>Amount (₹)<input type="number" step="0.01" required value={af.amount} onChange={e => setAf({ ...af, amount: e.target.value })} /></label>
      <label className="full">Reason<input required value={af.reason} onChange={e => setAf({ ...af, reason: e.target.value })} /></label>
      {err && <p className="error full">{err}</p>}<span><button className="btn" disabled={busy}>Save adjustment</button> <button type="button" className="btn ghost" onClick={() => setAdj(null)}>Cancel</button></span></form>}
    <div className="filters"><input placeholder="Search student…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
      <select value={cls} onChange={e => { setCls(e.target.value); setPage(0) }}><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    {loading ? <Loading /> : list.length === 0 ? <Empty>No students found.</Empty> : <div className="table-wrap register"><table><thead><tr><th>Sr</th><th>Name</th><th>DOJ</th>
      {Array.from({ length: cols }, (_, k) => <th key={k}>{ord(k + 1)} MONTH</th>)}{hasGap && <th>GAP FEE</th>}<th>Pending</th></tr></thead><tbody>
      {list.map(({ st, acc, cyc, gaps }, n) => { const name = st.profiles.full_name, all = [...cyc, ...gaps]
        return <tr key={st.id}><td>{page * SIZE + n + 1}</td><td><b>{name}</b>{st.status === 'inactive' && <span className="chip overdue">left</span>}<br /><small>{st.student_code} • {st.classes?.name || '—'}</small></td>
          <td>{dmy(acc?.billing_start_date || st.admission_date)}</td>
          {!acc ? <td colSpan={cols + (hasGap ? 1 : 0)} className="muted">Fee not set — use Fee Setup</td> : <>
            {Array.from({ length: cols }, (_, k) => <MonthCell key={k} i={cyc.find(c => c.period_no === k + 1)} name={name} onPay={openPay} onAdj={openAdj} />)}
            {hasGap && <td className="rc">{gaps.map(g => <MonthCell key={g.id} i={g} name={name} onPay={openPay} onAdj={openAdj} />)}{gaps.length === 0 && '—'}</td>}</>}
          <td><b>{money(sum(all, i => i.balance))}</b></td></tr> })}</tbody></table></div>}
    <Pager page={page} setPage={setPage} total={total} size={SIZE} setSize={setSize} /></Page>)
}

/* ---------- admin: payments, one row per student with an eye to view receipts ---------- */
export function Payments() {
  const [q, setQ] = useState(''); const [method, setMethod] = useState(''); const [page, setPage] = useState(0); const [SIZE, setSize] = useState(10); const [open, setOpen] = useState(null)
  const [rows, loading, , total] = useLoad(() => {
    let x = supabase.from('students').select('id, student_code, classes(name), profiles!inner(full_name), fee_payments!inner(*, fee_invoices(kind,period_start,period_end))', { count: 'exact' })
      .order('created_at', { ascending: true }).range(page * SIZE, page * SIZE + SIZE - 1)
    if (q) x = x.ilike('profiles.full_name', `%${q}%`)
    if (method) x = x.eq('fee_payments.method', method)
    return x
  }, [q, method, page, SIZE])
  const receipt = (st, p) => receiptPDF({ ...p, students: { student_code: st.student_code, classes: st.classes, profiles: st.profiles } })
  return (<Page title="Payment History"><div className="filters"><input placeholder="Search student…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
    <select value={method} onChange={e => { setMethod(e.target.value); setPage(0) }}><option value="">All methods</option>{METHOD_OPTIONS.map(k => <option key={k} value={k}>{METHODS[k]}</option>)}</select></div>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No payments recorded.</Empty> : <div className="table-wrap"><table><thead><tr><th>Sr</th><th>Student</th><th>Receipts</th><th>Total paid</th><th>Last payment</th><th>View</th></tr></thead><tbody>
      {rows.map((st, n) => { const ps = [...st.fee_payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at)), isOpen = open === st.id
        return [<tr key={st.id}><td>{page * SIZE + n + 1}</td><td><b>{st.profiles.full_name}</b><br /><small>{st.student_code} • {st.classes?.name || '—'}</small></td><td>{ps.length}</td><td>{money(sum(ps, p => p.amount))}</td><td>{dmy(ps[0].paid_on)}</td>
          <td><button className="icon-btn" title={isOpen ? 'Hide receipts' : 'View receipts'} aria-label="View receipts" onClick={() => setOpen(isOpen ? null : st.id)}>{isOpen ? '🙈' : '👁'}</button></td></tr>,
        isOpen && <tr key={st.id + 'r'}><td colSpan="6" className="nested"><table><thead><tr><th>Date</th><th>Receipt no.</th><th>Billing period</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>
          {ps.map(p => <tr key={p.id}><td>{dmy(p.paid_on)}</td><td>{p.receipt_no}</td><td>{p.fee_invoices && periodLabel(p.fee_invoices)}</td><td>{METHODS[p.method]}{p.reference && <><br /><small>{p.reference}</small></>}</td><td>{money(p.amount)}</td>
            <td><button className="link" onClick={() => receipt(st, p)}>Receipt PDF</button></td></tr>)}</tbody></table></td></tr>] })}</tbody></table></div>}
    <Pager page={page} setPage={setPage} total={total} size={SIZE} setSize={setSize} /></Page>)
}

/* ---------- admin: import past fee history from CSV ---------- */
function FeeImport({ onDone }) {
  const [rows, setRows] = useState([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null)
  const template = () => downloadCSV('fee-history-template.csv', ['email', 'monthly_fee', 'billing_start_date', 'payment_dates', 'method'], [['student@example.com', '1500', '2026-08-01', '2026-08-31;2026-09-30', 'cash']])
  const onFile = async e => {
    setErr(''); setRes(null); setRows([]); const f = e.target.files[0]; if (!f) return
    const p = parseCSV((await f.text()).replace(/^\uFEFF/, '')); const head = p[0].map(h => h.trim().toLowerCase())
    if (!['email', 'monthly_fee', 'billing_start_date'].every(h => head.includes(h))) return setErr('The file needs the columns email, monthly_fee and billing_start_date. Download the template.')
    const list = p.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
    const bad = []
    const out = list.map((r, i) => {
      const dates = (r.payment_dates || '').split(/[;|]/).map(x => x.trim()).filter(Boolean).map(toISO)
      if (!toISO(r.billing_start_date)) bad.push(`Row ${i + 2}: billing_start_date is not a valid date`)
      if (dates.some(d => !d)) bad.push(`Row ${i + 2}: a payment date is not valid`)
      return { email: r.email, monthly_fee: r.monthly_fee, billing_start_date: toISO(r.billing_start_date), payment_dates: dates, method: (r.method || '').toLowerCase() }
    })
    if (bad.length) return setErr(bad.slice(0, 5).join(' • '))
    if (!out.length) return setErr('The file has no rows.')
    setRows(out)
  }
  const run = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('import_fee_history', { p_rows: rows })
    setBusy(false); if (error) return setErr(error.message)
    setRes(data); setRows([]); onDone()
  }
  const bad = res?.filter(r => !r.ok)
  return (<div className="card"><h3>Import fee history (CSV)</h3>
    <p className="muted small">Columns: <code>email, monthly_fee, billing_start_date, payment_dates, method</code>. List the months already paid in order, separated by <code>;</code> — the 1st date pays the 1st billing month, the 2nd date the 2nd month, and so on. Method is <code>cash</code> or <code>online</code> (blank = cash). Students must already exist, and each student can be imported only once.</p>
    <p><button className="btn ghost sm" onClick={template}>Download template</button></p>
    <input type="file" accept=".csv,text/csv" onChange={onFile} />
    {err && <p className="error">{err}</p>}
    {rows.length > 0 && <p><b>{rows.length}</b> students ready. <button className="btn" disabled={busy} onClick={run}>{busy ? 'Importing…' : 'Import now'}</button></p>}
    {res && <><p className="ok"><b>{res.filter(r => r.ok).length}</b> students imported ({sum(res, r => r.payments)} payments).{bad.length > 0 && <span className="error"> {bad.length} failed:</span>}</p>
      {bad.length > 0 && <div className="table-wrap"><table><thead><tr><th>Email</th><th>Problem</th></tr></thead><tbody>{bad.map((r, i) => <tr key={i}><td>{r.email}</td><td className="error">{r.error}</td></tr>)}</tbody></table></div>}</>}
  </div>)
}

/* ---------- admin: per-student fee setup ---------- */
export function FeeSetup() {
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [SIZE, setSize] = useState(10); const [edit, setEdit] = useState(null); const [hist, setHist] = useState(null); const [err, setErr] = useState(''); const [imp, setImp] = useState(false)
  const [rows, loading, reload, total] = useLoad(() => {
    let x = supabase.from('students').select('id, student_code, status, admission_date, classes(name), profiles!inner(full_name), fee_accounts(*)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1)
    if (q) x = x.ilike('profiles.full_name', `%${q}%`)
    return x
  }, [q, page, SIZE])
  const open = s => { const a = one(s.fee_accounts); setHist(null); setErr(''); setEdit({ s, exists: !!a, monthly_fee: a?.monthly_fee ?? '', billing_start_date: a?.billing_start_date || s.admission_date || today(), active: a?.active ?? true }) }
  const save = async e => {
    e.preventDefault(); setErr('')
    const fee = Number(edit.monthly_fee); if (!(fee >= 0) || edit.monthly_fee === '') return setErr('Enter the monthly fee.')
    const body = { student_id: edit.s.id, monthly_fee: fee, active: edit.active }
    const r = edit.exists ? await supabase.from('fee_accounts').update(body).eq('student_id', edit.s.id) : await supabase.from('fee_accounts').insert({ ...body, billing_start_date: edit.billing_start_date })
    if (r.error) return setErr(r.error.message)
    await supabase.rpc('generate_invoices', { p_student: edit.s.id }); setEdit(null); reload()
  }
  return (<Page title="Fee Setup" action={<button className="btn ghost" onClick={() => setImp(!imp)}>{imp ? 'Close Import' : 'Import fee history'}</button>}>{imp && <FeeImport onDone={reload} />}<p className="muted small">Set each student's monthly fee and billing start date. Billing runs on fixed 31-day cycles that are never reset. A new fee applies to future invoices only.</p>
    {edit && <form className="form card" onSubmit={save}><h3 className="full">{edit.s.profiles.full_name} ({edit.s.student_code})</h3>
      <label>Monthly fee (₹ per 31 days)<input type="number" step="0.01" required value={edit.monthly_fee} onChange={e => setEdit({ ...edit, monthly_fee: e.target.value })} /></label>
      <label>Billing start date{edit.exists && ' (locked)'}<DateInput required disabled={edit.exists} value={edit.billing_start_date} onChange={v => setEdit({ ...edit, billing_start_date: v })} /></label>
      <label>Billing<select value={edit.active ? '1' : '0'} onChange={e => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">Active</option><option value="0">Paused</option></select></label>
      {err && <p className="error full">{err}</p>}<span><button className="btn">Save fee setup</button> <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></span></form>}
    <div className="filters"><input placeholder="Search student…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} /></div>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No students found.</Empty> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Monthly fee</th><th>Billing start</th><th>Next due</th><th></th></tr></thead><tbody>
      {rows.map(s => { const a = one(s.fee_accounts); return <tr key={s.id}><td>{s.profiles.full_name}<br /><small>{s.student_code}</small></td><td>{s.classes?.name || '—'}</td>
        <td>{a ? <span className="mask" title="Hidden. Open Edit fee to view or change.">₹ ••••••</span> : <span className="muted">Not set</span>}</td><td>{a ? dmy(a.billing_start_date) : '—'}</td><td>{a && a.active ? dmy(nextDue(a.billing_start_date)) : '—'}</td>
        <td className="actions"><ActionMenu items={[{ label: a ? 'Edit fee' : 'Set fee', onClick: () => open(s) }, { label: 'History', onClick: () => { setEdit(null); setHist(hist?.id === s.id ? null : s) } }]} /></td></tr> })}</tbody></table></div>}
    <Pager page={page} setPage={setPage} total={total} size={SIZE} setSize={setSize} />
    {hist && <div><h2>Fee history — {hist.profiles.full_name}</h2><FeeHistory studentId={hist.id} /></div>}</Page>)
}

/* ---------- admin: leave & rejoining ---------- */
export function Leave() {
  const [students] = useLoad(() => supabase.from('students').select('id, student_code, profiles!inner(full_name)').eq('status', 'active').order('created_at'), [])
  const [rows, loading, reload] = useLoad(() => supabase.from('leave_records').select('*, students(student_code, profiles(full_name), fee_accounts(monthly_fee))').order('created_at', { ascending: false }), [])
  const [sf, setSf] = useState({ student: '', start: today() }); const [rj, setRj] = useState(null); const [invs, setInvs] = useState([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const startLeave = async e => { e.preventDefault(); setErr(''); const { error } = await supabase.rpc('record_leave', { p_student: sf.student, p_start: sf.start }); if (error) return setErr(error.message); setSf({ student: '', start: today() }); reload() }
  const openRejoin = async r => { setErr(''); setRj({ r, date: today(), policy: 'charge', custom: '', note: '' }); setInvs((await supabase.from('fee_invoices').select('period_start,period_end').eq('student_id', r.student_id).eq('kind', 'cycle')).data || []) }
  const calc = rj && (() => {
    const fee = Number(one(rj.r.students.fee_accounts)?.monthly_fee || 0), days = daysBetween(rj.r.leave_start, rj.date), last = addDays(rj.date, -1)
    const billed = invs.reduce((t, i) => { const a = i.period_start > rj.r.leave_start ? i.period_start : rj.r.leave_start, b = i.period_end < last ? i.period_end : last; return t + Math.max(0, daysBetween(a, b) + 1) }, 0)
    const charge = gapAmount(days, fee), amt = rj.policy === 'charge' ? charge : rj.policy === 'custom' ? Number(rj.custom || 0) : 0
    return { fee, days, billed, charge, amt, daily: fee / 31 }
  })()
  const saveRejoin = async e => {
    e.preventDefault(); setErr('')
    if (calc.days <= 0) return setErr('Rejoining date must be after the leave start date.')
    if (rj.policy === 'custom' && !(Number(rj.custom) >= 0 && rj.custom !== '')) return setErr('Enter the custom amount.')
    setBusy(true)
    const { error } = await supabase.rpc('record_rejoin', { p_leave: rj.r.id, p_rejoin: rj.date, p_policy: rj.policy, p_custom: Number(rj.custom || 0), p_note: rj.note || null })
    setBusy(false); if (error) return setErr(error.message); setRj(null); reload()
  }
  return (<Page title="Leave & Rejoining">
    <form className="form card" onSubmit={startLeave}><h3 className="full">Mark a student on leave</h3>
      <label>Student<select required value={sf.student} onChange={e => setSf({ ...sf, student: e.target.value })}><option value="">Select…</option>{students.map(s => <option key={s.id} value={s.id}>{s.profiles.full_name} ({s.student_code})</option>)}</select></label>
      <label>Leave start date<DateInput required value={sf.start} onChange={v => setSf({ ...sf, start: v })} /></label>
      {!rj && err && <p className="error full">{err}</p>}<button className="btn">Record leave</button></form>
    {rj && <form className="form card" onSubmit={saveRejoin}><h3 className="full">Record rejoining — {rj.r.students.profiles.full_name}</h3>
      <label>Rejoining date<DateInput required value={rj.date} onChange={v => setRj({ ...rj, date: v })} /></label>
      <label>Gap fee policy<select value={rj.policy} onChange={e => setRj({ ...rj, policy: e.target.value })}><option value="charge">Charge the fee for the gap</option><option value="waive">Waive the gap fee</option><option value="custom">Custom fee adjustment</option></select></label>
      {rj.policy === 'custom' && <label>Custom amount (₹)<input type="number" step="0.01" value={rj.custom} onChange={e => setRj({ ...rj, custom: e.target.value })} /></label>}
      <label className="full">Note (optional)<input value={rj.note} onChange={e => setRj({ ...rj, note: e.target.value })} /></label>
      <div className="full calc"><b>Calculation (shown before saving)</b>
        <p>Gap: {dmy(rj.r.leave_start)} to {dmy(addDays(rj.date, -1))} = <b>{calc.days} days</b></p>
        <p>Daily fee: {money(calc.fee)} ÷ 31 = {money(calc.daily.toFixed(2))}</p>
        <p>Gap fee if charged: {calc.days} × {money(calc.daily.toFixed(2))} = <b>{money(calc.charge)}</b></p>
        {calc.billed > 0 && <p className="warn">{calc.billed} of these days are already inside cycle invoices issued earlier. Choose Waive or Custom if you do not want to charge them twice.</p>}
        {calc.fee === 0 && <p className="warn">No monthly fee is set for this student, so a charged gap will be ₹0.</p>}
        <p>Amount to add to the student's fees: <b>{money(calc.amt)}</b></p></div>
      {err && <p className="error full">{err}</p>}<span><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save rejoining'}</button> <button type="button" className="btn ghost" onClick={() => setRj(null)}>Cancel</button></span></form>}
    <h3>Leave history</h3>
    {loading ? <Loading /> : rows.length === 0 ? <Empty>No leave records.</Empty> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Left on</th><th>Rejoined</th><th>Gap days</th><th>Policy</th><th>Gap fee</th><th></th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td>{r.students.profiles.full_name}<br /><small>{r.students.student_code}</small></td><td>{dmy(r.leave_start)}</td><td>{r.rejoin_date ? dmy(r.rejoin_date) : <span className="chip partial">on leave</span>}</td>
        <td>{r.gap_days ?? '—'}</td><td>{r.policy || '—'}</td><td>{r.rejoin_date ? money(r.gap_amount) : '—'}</td><td>{!r.rejoin_date && <button className="link" onClick={() => openRejoin(r)}>Record rejoining</button>}</td></tr>)}</tbody></table></div>}</Page>)
}

/* ---------- admin: fee reports ---------- */
export function FeeReports() {
  const [from, setFrom] = useState(today().slice(0, 8) + '01'); const [to, setTo] = useState(today())
  const [pays, l1] = useLoad(() => supabase.from('fee_payments').select(RECEIPT_SELECT).gte('paid_on', from).lte('paid_on', to).order('paid_on'), [from, to])
  const [pend, l2] = useLoad(() => supabase.from('fee_invoices').select('*, students(student_code, classes(name), profiles(full_name))').gt('balance', 0).order('due_date'), [])
  const payRows = pays.map(p => [dmy(p.paid_on), p.receipt_no, p.students?.profiles?.full_name, p.students?.student_code, p.students?.classes?.name || '', p.fee_invoices ? periodLabel(p.fee_invoices) : '', METHODS[p.method], Number(p.amount).toFixed(2)])
  const payHead = ['Date', 'Receipt', 'Student', 'ID', 'Class', 'Period', 'Method', 'Amount']
  const pendRows = pend.map(i => [i.students?.profiles?.full_name, i.students?.student_code, i.students?.classes?.name || '', periodLabel(i), dmy(i.due_date), Number(i.balance).toFixed(2), i.due_date < today() ? 'Overdue' : 'Pending'])
  const pendHead = ['Student', 'ID', 'Class', 'Period', 'Due', 'Balance', 'Status']
  const byMethod = METHOD_OPTIONS.map(m => [METHODS[m], sum(pays.filter(p => p.method === m), p => p.amount)])
  const byMonth = Object.entries(pays.reduce((o, p) => { const k = p.paid_on.slice(0, 7); o[k] = (o[k] || 0) + Number(p.amount); return o }, {}))
  return (<Page title="Fee Reports">
    <div className="filters"><label>From<DateInput value={from} onChange={setFrom} /></label><label>To<DateInput value={to} onChange={setTo} /></label></div>
    <h3>Fee collection</h3>
    {l1 ? <Loading /> : <><div className="grid stats"><div className="card stat"><b>{money(sum(pays, p => p.amount))}</b><span>Collected ({pays.length} payments)</span></div>
      {byMethod.map(([m, v]) => <div className="card stat" key={m}><b>{money(v)}</b><span>{m}</span></div>)}</div>
      {byMonth.length > 0 && <p className="muted small">Monthly: {byMonth.map(([k, v]) => `${k}: ${money(v)}`).join('  •  ')}</p>}
      <p><button className="btn sm" disabled={!pays.length} onClick={() => downloadCSV(`fee-collection-${from}-to-${to}.csv`, payHead, payRows)}>Excel (CSV)</button> <button className="btn sm ghost" disabled={!pays.length} onClick={() => tablePDF('Fee collection report', `${dmy(from)} to ${dmy(to)}`, payHead, payRows, `fee-collection-${from}-to-${to}.pdf`)}>PDF</button></p></>}
    <h3>Pending fees (all students)</h3>
    {l2 ? <Loading /> : <><div className="grid stats"><div className="card stat"><b>{money(sum(pend, i => i.balance))}</b><span>Total pending</span></div><div className="card stat"><b>{money(sum(pend.filter(i => i.due_date < today()), i => i.balance))}</b><span>Overdue</span></div></div>
      <p><button className="btn sm" disabled={!pend.length} onClick={() => downloadCSV('pending-fees.csv', pendHead, pendRows)}>Excel (CSV)</button> <button className="btn sm ghost" disabled={!pend.length} onClick={() => tablePDF('Pending fee report', dmy(today()), pendHead, pendRows, 'pending-fees.pdf')}>PDF</button></p>
      {pend.length === 0 ? <Empty>No pending fees.</Empty> : <div className="table-wrap"><table><thead><tr>{pendHead.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{pendRows.slice(0, 50).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{j === 5 ? money(c) : c}</td>)}</tr>)}</tbody></table></div>}</>}
  </Page>)
}
