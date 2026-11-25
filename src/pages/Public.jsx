import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Blocks, Shapes, BookOpen, Pencil, Trophy, Atom, FlaskConical, Globe, Ruler, Calculator, BookText, GraduationCap, BarChart3, Landmark,
  Lightbulb, ClipboardCheck, Users, BookOpenText, TrendingUp, Megaphone, Send, User, MapPin, Link2, ArrowRight, Menu, X } from 'lucide-react'
import { supabase } from '../supabase.js'
import { useLoad } from '../auth.jsx'
import { fmt } from '../modules/ui.jsx'

const ADDRESS = 'Village Birh Kathgarh, PO Kathgarh, Tehsil Balachaur, District SBS Nagar, Punjab'
const links = [['/', 'Home'], ['/about', 'About'], ['/founder', 'Founder'], ['/courses', 'Courses'], ['/methodology', 'Methodology'], ['/achievements', 'Achievements'], ['/gallery', 'Gallery'], ['/admissions', 'Admissions'], ['/contact', 'Contact']]
const ICONS = [Blocks, Shapes, BookOpen, Pencil, Trophy, Atom, FlaskConical, Globe, Ruler, Calculator, BookText, GraduationCap, BarChart3, Landmark]
const NAMES = ['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
const NOTES = ['Foundational learning.', 'Foundational learning.', ...Array(10).fill('All subjects.'), 'Details available on enquiry.', 'Arts stream: English, History, Political Science, Economics.']
export const CLASSES = NAMES.map((n, i) => [n, NOTES[i], ICONS[i]])

// shows a photo from /public if it exists, otherwise the fallback
function Photo({ src, alt, fallback }) {
  const [bad, setBad] = useState(false)
  return bad ? fallback : <img src={src} alt={alt} onError={() => setBad(true)} />
}

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (<div className="pub">
    <header className="site-head"><div className="site-bar">
      <Link to="/" className="site-brand"><img src="/logo.png" alt="Achievers Learning Academy" /><span className="vr" /><span className="site-name"><b>Achievers Learning Academy</b><small>Learn • Grow • Achieve</small></span></Link>
      <nav className={open ? 'open' : ''} onClick={() => setOpen(false)}>{links.map(([to, t]) => <NavLink key={to} to={to} end>{t}</NavLink>)}
        <Link className="site-cta mob" to="/login"><GraduationCap size={18} /> Student Login</Link></nav>
      <Link className="site-cta desk" to="/login"><GraduationCap size={18} /> Student Login <ArrowRight size={16} /></Link>
      <button className="burger" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div></header>
    <main><Outlet /></main>
    <footer className="site-foot"><div className="ft-brand"><img src="/logo.png" alt="" /><span className="vr" /><div><b>Achievers Learning Academy</b><small>Learn • Grow • Achieve</small></div></div>
      <div className="ft-col"><MapPin size={20} /><div><b>Address</b><p>{ADDRESS}</p></div></div>
      <div className="ft-col"><Link2 size={20} /><div><b>Links</b><p><Link to="/admissions">Admissions</Link> | <Link to="/login">Student Login</Link> | <Link to="/admin-login">Admin Login</Link></p></div></div></footer>
  </div>)
}

const Hero = ({ title, sub }) => <section className="page-hero"><h1>{title}</h1>{sub && <p>{sub}</p>}</section>
const Sec = ({ title, children }) => <section className="sec">{title && <h2 className="sec-title">{title}</h2>}{children}</section>

function ClassGrid() {
  return (<div className="cl-grid">{CLASSES.map(([t, d, Icon]) => <div className={'cl-card' + (t === '11th' || t === '12th' ? ' wide' : '')} key={t}><Icon size={38} strokeWidth={1.6} /><div><b>{t}</b><small>{d}</small></div></div>)}</div>)
}

export function Home() {
  const [ann] = useLoad(() => supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }).limit(1), [])
  const a = ann[0]
  const why = [[Lightbulb, 'Concept-based learning', 'b'], [ClipboardCheck, 'Regular assessments', 'g'], [Users, 'Individual attention', 'p'], [BookOpenText, 'Practice exercises', 'g'], [TrendingUp, 'Continuous academic improvement', 'b']]
  return (<>
    <section className="hero2"><div className="hero2-in">
      <div className="hero2-text"><h1>Learn <i>•</i> Grow <i>•</i> <span>Achieve</span></h1>
        <p>Achievers Learning Academy, established in 2024, provides quality education, personalised attention and academic support.</p>
        <div className="hero2-btns"><Link to="/admissions" className="btn-g"><Send size={18} /> Admission Enquiry <ArrowRight size={16} /></Link><Link to="/login" className="btn-o"><User size={18} /> Student Login</Link></div></div>
      <div className="hero2-photo"><Photo src="/hero.jpg" alt="Students of Achievers Learning Academy" fallback={<div className="hero2-fallback"><img src="/logo.png" alt="" /></div>} /></div>
    </div></section>
    <section className="sec"><div className="sec-row"><h2 className="sec-title">Classes Offered</h2><Link className="pill" to="/courses">View All Courses <ArrowRight size={15} /></Link></div><ClassGrid /></section>
    <section className="sec why"><h2 className="sec-title">Why Choose Us?</h2><div className="why-row">{why.map(([Icon, t, c]) => <div className="why-item" key={t}><span className={'why-ic ' + c}><Icon size={30} strokeWidth={1.6} /></span><b>{t}</b></div>)}</div></section>
    <section className="sec two">
      <div className="founder"><div className="founder-photo"><Photo src="/founder.jpg" alt="Gaurav Kumar" fallback={<span className="initials">GK</span>} /></div>
        <div><small className="meet">Meet the Founder</small><h3>Gaurav Kumar</h3><p>BCA Cybersecurity (Lamrin Tech Skills University Punjab) and BA (Lovely Professional University).</p><Link to="/founder" className="btn-n">Read Profile <ArrowRight size={16} /></Link></div></div>
      <div className="annc"><div className="annc-head"><span><Megaphone size={20} /> Latest Announcements</span><Link to="/announcements">View All <ArrowRight size={14} /></Link></div>
        {a ? <div className="annc-body"><span className="annc-ic"><BookOpen size={44} strokeWidth={1.4} /></span><div><small><em>{a.category}</em> • {fmt(a.created_at)}</small><h4>{a.title}</h4><p>{a.body}</p></div></div> : <p className="annc-empty">No announcements at the moment.</p>}</div>
    </section></>)
}

export const About = () => (<><Hero title="About Us" /><Sec><p>Achievers Learning Academy was established in 2024 with the objective of providing quality education, personalised attention and academic support.</p>
  <div className="grid"><div className="card"><h3>Our Vision</h3><p>To develop confident, knowledgeable and responsible learners through quality education.</p></div>
    <div className="card"><h3>Our Mission</h3><p>To provide accessible, student-centred education that strengthens academic foundations, critical thinking and overall development.</p></div>
    <div className="card"><h3>Our Teaching Approach</h3><p>Concept-based learning, regular assessments, individual attention, practice exercises and continuous academic improvement.</p></div></div></Sec></>)
export const Founder = () => (<><Hero title="Founder Profile" sub="Gaurav Kumar" /><Sec><div className="grid">
  <div className="card"><h3>Qualifications</h3><ul><li>BCA Cybersecurity – Lamrin Tech Skills University Punjab</li><li>BA – Lovely Professional University, Phagwara</li></ul></div>
  <div className="card"><h3>Experience</h3><ul><li>IELTS and Spoken English Trainer for two months at Hashtag Overseas LLP, Ropar</li></ul></div>
  <div className="card"><h3>Skills</h3><ul><li>Communication Skills</li><li>Leadership Skills</li><li>Student Management and Interaction</li><li>Presentation and Public Speaking</li></ul></div></div></Sec></>)
export const Courses = () => (<><Hero title="Classes and Courses" /><Sec><ClassGrid /></Sec></>)
export const Methodology = () => (<><Hero title="Teaching Methodology" /><Sec><div className="grid">{[['Concept-based learning', 'Building strong understanding before practice.'], ['Regular assessments', 'Frequent tests to track progress.'], ['Individual attention', 'Personal support for every learner.'], ['Practice exercises', 'Reinforcing each topic through practice.'], ['Continuous improvement', 'Reviewing and improving academic performance steadily.']].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></Sec></>)
export const Achievements = () => (<><Hero title="Student Achievements" /><Sec><p className="muted">Student achievements will be published here by the academy.</p></Sec></>)
export const Gallery = () => (<><Hero title="Gallery" /><Sec><p className="muted">Photos from the academy will be added here.</p></Sec></>)
export const Contact = () => (<><Hero title="Contact Us" /><Sec><div className="card"><h3>Address</h3><p>{ADDRESS}</p></div><p>For admission or other questions, please send an <Link to="/admissions">enquiry</Link> and we will get back to you.</p></Sec></>)

export function PublicAnnouncements() {
  const [rows, loading] = useLoad(() => supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }), [])
  return (<><Hero title="Announcements" /><Sec>{loading ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted">No announcements at the moment.</p> : rows.map(a => <div className="card" key={a.id}><small>{a.category} • {fmt(a.created_at)}</small><h3>{a.title}</h3><p>{a.body}</p></div>)}</Sec></>)
}

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
