import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'

const Login            = lazy(() => import('./pages/Login'))
const Register         = lazy(() => import('./pages/Register'))
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'))
const UserDashboard    = lazy(() => import('./pages/UserDashboard'))
const Tasks            = lazy(() => import('./pages/Tasks'))
const TaskDetail       = lazy(() => import('./pages/TaskDetail'))
const CreateTask       = lazy(() => import('./pages/CreateTask'))
const Teams            = lazy(() => import('./pages/Teams'))
const Notifications    = lazy(() => import('./pages/Notifications'))
const Assignments      = lazy(() => import('./pages/Assignments'))
const AdminUsers       = lazy(() => import('./pages/AdminUsers'))
const AdminBanks       = lazy(() => import('./pages/AdminBanks'))
const ActivityLog      = lazy(() => import('./pages/ActivityLog'))
const ZammadTickets    = lazy(() => import('./pages/ZammadTickets'))
const Deployments      = lazy(() => import('./pages/Deployments'))

function Spinner() {
  return (
    <div className="loading" style={{ height: '100vh' }}>
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireManager({ children }) {
  const { user, isManager } = useAuth()
  if (!user)      return <Navigate to="/login" replace />
  if (!isManager) return <Navigate to="/dashboard/user" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user)     return <Navigate to="/login" replace />
  if (!isAdmin)  return <Navigate to="/" replace />
  return children
}

function DashboardRedirect() {
  const { isManager } = useAuth()
  return <Navigate to={isManager ? '/dashboard/manager' : '/dashboard/user'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected — inside layout */}
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardRedirect />} />
          <Route path="dashboard" element={<DashboardRedirect />} />

          <Route path="dashboard/manager" element={
            <RequireManager><ManagerDashboard /></RequireManager>
          } />
          <Route path="dashboard/user" element={<UserDashboard />} />

          <Route path="tasks"      element={<RequireManager><Tasks /></RequireManager>} />
          <Route path="tasks/new"  element={<RequireManager><CreateTask /></RequireManager>} />
          <Route path="tasks/:id"  element={<TaskDetail />} />

          <Route path="teams"         element={<Teams />} />
          <Route path="assignments"   element={<Assignments />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="activity"        element={<RequireManager><ActivityLog /></RequireManager>} />
          <Route path="tickets/zammad" element={<RequireManager><ZammadTickets /></RequireManager>} />
          <Route path="deployments" element={<RequireManager><Deployments /></RequireManager>} />

          <Route path="admin/users" element={
            <RequireAdmin><AdminUsers /></RequireAdmin>
          } />
          <Route path="admin/users/new" element={
            <RequireAdmin><Register /></RequireAdmin>
          } />
          <Route path="admin/banks" element={
            <RequireAdmin><AdminBanks /></RequireAdmin>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  )
}
