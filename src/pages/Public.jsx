import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useLoad } from '../auth.jsx'

const ADDRESS = 'Village Birh Kathgarh, PO Kathgarh, Tehsil Balachaur, District SBS Nagar, Punjab'
const links = [['/', 'Home'], ['/about', 'About'], ['/founder', 'Founder'], ['/courses', 'Courses'], ['/methodology', 'Methodology'], ['/achievements', 'Achievements'], ['/gallery', 'Gallery'], ['/admissions', 'Admissions'], ['/contact', 'Contact']]
export const CLASSES = [
  ['Kindergarten', 'Foundational learning.'], ['Classes 1–5', 'All subjects.'], ['Classes 6–8', 'All subjects.'], ['Classes 9–10', 'All subjects.'],
  ['Class 12 – Arts Stream', 'English, History, Political Science, Economics.']]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (<>
    <header className="pub-nav"><Link to="/" className="brand-l"><img src="/logo.png" alt="Achievers Learning Academy" /><span>Achievers Learning Academy<small>Learn • Grow • Achieve</small></span></Link>
      <button className="icon-btn hamburger" onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? 'open' : ''} onClick={() => setOpen(false)}>{links.map(([to, t]) => <NavLink key={to} to={to} end>{t}</NavLink>)}
        <Link className="btn sm" to="/login">Student Login</Link></nav></header>
    <main><Outlet /></main>
    <footer className="foot"><div><img src="/logo.png" alt="" className="foot-logo" /><p><b>Achievers Learning Academy</b><br />Learn • Grow • Achieve</p></div>
      <div><b>Address</b><p>{ADDRESS}</p></div>
      <div><b>Links</b><p><Link to="/admissions">Admissions</Link><br /><Link to="/login">Student Login</Link><br /><Link to="/admin-login">Admin Login</Link></p></div></footer>
  </>)
}

const Hero = ({ title, sub }) => <section className="page-hero"><h1>{title}</h1>{sub && <p>{sub}</p>}</section>
const Sec = ({ title, children }) => <section className="sec">{title && <h2>{title}</h2>}{children}</section>

export function Home() {
  const [ann] = useLoad(() => supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }).limit(3), [])
  return (<>
    <section className="hero"><img src="/logo.png" alt="" /><div><h1>Learn • Grow • Achieve</h1>
      <p>Achievers Learning Academy, established in 2024, provides quality education, personalised attention and academic support.</p>
      <Link to="/admissions" className="btn">Admission Enquiry</Link> <Link to="/login" className="btn ghost light">Student Login</Link></div></section>
    <Sec title="Classes Offered"><div className="grid">{CLASSES.map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></Sec>
    <Sec title="Why Choose Us?"><div className="grid">{['Concept-based learning', 'Regular assessments', 'Individual attention', 'Practice exercises', 'Continuous academic improvement'].map(t => <div className="card" key={t}><h3>{t}</h3></div>)}</div></Sec>
    <Sec title="Meet the Founder"><div className="card"><h3>Gaurav Kumar</h3><p>BCA Cybersecurity (Lamrin Tech Skills University Punjab) and BA (Lovely Professional University). <Link to="/founder">Read profile →</Link></p></div></Sec>
    <Sec title="Latest Announcements">{ann.length === 0 ? <p className="muted">No announcements at the moment.</p> : ann.map(a => <div className="card" key={a.id}><small>{a.category} • {new Date(a.created_at).toLocaleDateString()}</small><h3>{a.title}</h3><p>{a.body}</p></div>)}</Sec>
  </>)
}
export const About = () => (<><Hero title="About Us" /><Sec><p>Achievers Learning Academy was established in 2024 with the objective of providing quality education, personalised attention and academic support.</p>
  <div className="grid"><div className="card"><h3>Our Vision</h3><p>To develop confident, knowledgeable and responsible learners through quality education.</p></div>
    <div className="card"><h3>Our Mission</h3><p>To provide accessible, student-centred education that strengthens academic foundations, critical thinking and overall development.</p></div>
    <div className="card"><h3>Our Teaching Approach</h3><p>Concept-based learning, regular assessments, individual attention, practice exercises and continuous academic improvement.</p></div></div></Sec></>)
export const Founder = () => (<><Hero title="Founder Profile" sub="Gaurav Kumar" /><Sec><div className="grid">
  <div className="card"><h3>Qualifications</h3><ul><li>BCA Cybersecurity – Lamrin Tech Skills University Punjab</li><li>BA – Lovely Professional University, Phagwara</li></ul></div>
  <div className="card"><h3>Experience</h3><ul><li>IELTS and Spoken English Trainer for two months at Hashtag Overseas LLP, Ropar</li></ul></div>
  <div className="card"><h3>Skills</h3><ul><li>Communication Skills</li><li>Leadership Skills</li><li>Student Management and Interaction</li><li>Presentation and Public Speaking</li></ul></div></div></Sec></>)
export const Courses = () => (<><Hero title="Classes and Courses" /><Sec><div className="grid">{CLASSES.map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></Sec></>)
export const Methodology = () => (<><Hero title="Teaching Methodology" /><Sec><div className="grid">{[['Concept-based learning', 'Building strong understanding before practice.'], ['Regular assessments', 'Frequent tests to track progress.'], ['Individual attention', 'Personal support for every learner.'], ['Practice exercises', 'Reinforcing each topic through practice.'], ['Continuous improvement', 'Reviewing and improving academic performance steadily.']].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></Sec></>)
export const Achievements = () => (<><Hero title="Student Achievements" /><Sec><p className="muted">Student achievements will be published here by the academy.</p></Sec></>)
export const Gallery = () => (<><Hero title="Gallery" /><Sec><p className="muted">Photos from the academy will be added here.</p></Sec></>)
export const Contact = () => (<><Hero title="Contact Us" /><Sec><div className="card"><h3>Address</h3><p>{ADDRESS}</p></div><p>For admission or other questions, please send an <Link to="/admissions">enquiry</Link> and we will get back to you.</p></Sec></>)

export function Admissions() {
  const blank = { student_name: '', guardian_name: '', phone: '', class_applying: '', previous_school: '', address: '', notes: '' }
  const [f, setF] = useState(blank); const [state, setState] = useState(''); const [err, setErr] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!/^[0-9+\-\s]{8,15}$/.test(f.phone)) return setErr('Please enter a valid contact number.')
    setState('busy'); const { error } = await supabase.from('admission_enquiries').insert(f)
    if (error) { setErr('Could not send enquiry. Please try again.'); setState(''); return }
    setF(blank); setState('done')
  }
  return (<><Hero title="Admissions" sub="Send an enquiry and we will contact you." /><Sec>
    {state === 'done' ? <div className="card ok-card"><h3>Thank you!</h3><p>Your enquiry has been received.</p></div> :
      <form className="form card" onSubmit={submit}>
        <label>Student name<input required value={f.student_name} onChange={set('student_name')} /></label>
        <label>Parent/guardian name<input required value={f.guardian_name} onChange={set('guardian_name')} /></label>
        <label>Contact number<input required value={f.phone} onChange={set('phone')} /></label>
        <label>Class applying for<select required value={f.class_applying} onChange={set('class_applying')}><option value="">Select…</option>{CLASSES.map(([t]) => <option key={t}>{t}</option>)}</select></label>
        <label>Previous school<input value={f.previous_school} onChange={set('previous_school')} /></label>
        <label>Address<input value={f.address} onChange={set('address')} /></label>
        <label className="full">Additional information<textarea rows="3" value={f.notes} onChange={set('notes')} /></label>
        {err && <p className="error full">{err}</p>}<button className="btn" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Submit Enquiry'}</button></form>}</Sec></>)
}
