export const METHODS = { cash: 'Cash', online: 'Online', upi: 'UPI', bank_transfer: 'Bank transfer' }
export const METHOD_OPTIONS = ['cash', 'online']
export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const U = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }
export const daysBetween = (a, b) => Math.round((U(b) - U(a)) / 864e5)
export const addDays = (s, n) => new Date(U(s) + n * 864e5).toISOString().slice(0, 10)
export const dmy = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '')
export const gapAmount = (days, fee) => Math.round((days * fee) / 31 * 100) / 100
export const nextDue = start => { const d = daysBetween(start, today()); return d <= 0 ? start : addDays(start, Math.ceil(d / 31) * 31) }
export const RECEIPT_SELECT = '*, fee_invoices(kind,period_start,period_end), students(student_code, classes(name), profiles(full_name))'

export function downloadCSV(name, headers, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const text = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click()
}

const toDataURL = async url => {
  const b = await (await fetch(url)).blob()
  return new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b) })
}
const plain = s => String(s ?? '').replace(/₹/g, 'Rs. ')

export async function receiptPDF(p) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  try { doc.addImage(await toDataURL('/logo.png'), 'PNG', 12, 10, 26, 26) } catch { /* logo optional */ }
  doc.setTextColor(18, 41, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Achievers Learning Academy', 44, 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90)
  doc.text('Village Birh Kathgarh, PO Kathgarh, Tehsil Balachaur,', 44, 26); doc.text('District SBS Nagar, Punjab', 44, 30.5)
  doc.setDrawColor(127, 176, 51); doc.setLineWidth(0.8); doc.line(12, 40, 136, 40)
  doc.setTextColor(18, 41, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('FEE RECEIPT', 74, 52, { align: 'center' })
  const inv = p.fee_invoices, st = p.students
  const period = inv ? `${inv.kind === 'gap' ? 'Gap fee: ' : ''}${dmy(inv.period_start)} to ${dmy(inv.period_end)}` : ''
  const rows = [['Receipt no.', p.receipt_no], ['Date', dmy(p.paid_on)], ['Student name', st?.profiles?.full_name], ['Student ID', st?.student_code],
    ['Class', st?.classes?.name || '-'], ['Billing period', period], ['Payment method', METHODS[p.method] || p.method], ['Reference', p.reference || '-']]
  let y = 64; doc.setFontSize(10)
  for (const [k, v] of rows) { doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.text(k, 16, y); doc.setFont('helvetica', 'bold'); doc.setTextColor(30); doc.text(plain(v), 62, y); y += 8.5 }
  doc.setFillColor(238, 247, 224); doc.roundedRect(12, y + 2, 124, 24, 3, 3, 'F')
  doc.setTextColor(18, 41, 90); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Amount paid', 18, y + 11)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(plain(money(p.amount)), 130, y + 11, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Outstanding balance', 18, y + 20)
  doc.setFont('helvetica', 'bold'); doc.text(plain(money(p.balance_after)), 130, y + 20, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
  doc.text('This is a computer-generated receipt. Learn - Grow - Achieve', 74, 200, { align: 'center' })
  doc.save(`${p.receipt_no}.pdf`)
}

export async function tablePDF(title, subtitle, headers, rows, filename) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const w = 277 / headers.length
  const head = y => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setFillColor(238, 242, 249); doc.rect(10, y - 5, 277, 7, 'F'); doc.setTextColor(18, 41, 90); headers.forEach((h, i) => doc.text(plain(h), 11 + i * w, y)) }
  try { doc.addImage(await toDataURL('/logo.png'), 'PNG', 10, 8, 18, 18) } catch { /* optional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(18, 41, 90); doc.text('Achievers Learning Academy', 32, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90); doc.text(`${title}${subtitle ? ' - ' + subtitle : ''}`, 32, 23)
  let y = 38; head(y); y += 7; doc.setFont('helvetica', 'normal'); doc.setTextColor(30)
  for (const r of rows) {
    if (y > 195) { doc.addPage(); y = 15; head(y); y += 7; doc.setFont('helvetica', 'normal'); doc.setTextColor(30) }
    doc.setFontSize(8.5); r.forEach((c, i) => doc.text(doc.splitTextToSize(plain(c), w - 2)[0] || '', 11 + i * w, y)); y += 6.5
  }
  doc.save(filename)
}

export function parseCSV(text) {
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
// accepts 2026-08-31, 31-08-2026 or 31/08/2026
export const toISO = s => { s = String(s || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '' }
