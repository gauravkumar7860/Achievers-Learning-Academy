import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireRole } from './auth.jsx'
import { PublicLayout, Home, About, Founder, Courses, Methodology, Achievements, Gallery, Admissions, Contact } from './pages/Public.jsx'
import { Login, Reset } from './pages/Login.jsx'
import Shell from './pages/Shell.jsx'
import { adminModules, studentModules } from './registry.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} /><Route path="/about" element={<About />} /><Route path="/founder" element={<Founder />} />
        <Route path="/courses" element={<Courses />} /><Route path="/methodology" element={<Methodology />} />
        <Route path="/achievements" element={<Achievements />} /><Route path="/gallery" element={<Gallery />} />
        <Route path="/admissions" element={<Admissions />} /><Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login role="student" />} /><Route path="/admin-login" element={<Login role="admin" />} />
        <Route path="/reset" element={<Reset />} />
      </Route>
      <Route path="/admin" element={<RequireRole role="admin"><Shell title="Admin" modules={adminModules} base="/admin" /></RequireRole>}>
        {adminModules.map(m => <Route key={m.path} index={m.path === ''} path={m.path || undefined} element={m.element} />)}
      </Route>
      <Route path="/student" element={<RequireRole role="student"><Shell title="Student" modules={studentModules} base="/student" bell /></RequireRole>}>
        {studentModules.map(m => <Route key={m.path} index={m.path === ''} path={m.path || undefined} element={m.element} />)}
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
