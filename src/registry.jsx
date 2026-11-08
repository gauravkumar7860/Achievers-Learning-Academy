// ONE place to register dashboard modules. Phase 2 = add files + append entries here.
import * as A from './modules/admin.jsx'
import * as S from './modules/student.jsx'
import * as F from './modules/fees.jsx'

export const adminModules = [
  { path: '', label: 'Dashboard', icon: '▦', element: <A.Dashboard /> },
  { path: 'students', label: 'Students', icon: '☺', element: <A.Students /> },
  { path: 'fees', label: 'Fees', icon: '₹', element: <F.Fees /> },
  { path: 'payments', label: 'Payments', icon: '▣', element: <F.Payments /> },
  { path: 'fee-setup', label: 'Fee Setup', icon: '⚙', element: <F.FeeSetup /> },
  { path: 'leave', label: 'Leave & Rejoining', icon: '↺', element: <F.Leave /> },
  { path: 'fee-reports', label: 'Fee Reports', icon: '▤', element: <F.FeeReports /> },
  { path: 'classes', label: 'Classes & Subjects', icon: '☰', element: <A.Classes /> },
  { path: 'materials', label: 'Study Material', icon: '▤', element: <A.Materials /> },
  { path: 'announcements', label: 'Announcements', icon: '✉', element: <A.Announcements /> },
  { path: 'admissions', label: 'Admissions', icon: '✎', element: <A.Admissions /> },
  { path: 'activity', label: 'Activity Log', icon: '⏱', element: <A.Activity /> },
  // PHASE 2: Fees, Leave, Tests, Results, Reports go here
]
export const studentModules = [
  { path: '', label: 'Dashboard', icon: '▦', element: <S.Home /> },
  { path: 'materials', label: 'Study Material', icon: '▤', element: <S.Materials /> },
  { path: 'fees', label: 'My Fees', icon: '₹', element: <F.MyFees /> },
  { path: 'announcements', label: 'Announcements', icon: '✉', element: <S.Announcements /> },
  { path: 'notifications', label: 'Notifications', icon: '🔔', element: <S.Notifications /> },
  { path: 'profile', label: 'My Profile', icon: '☺', element: <S.Profile /> },
  // PHASE 2: Tests, Results, Fees go here
]
