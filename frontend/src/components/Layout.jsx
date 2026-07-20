import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getNotifications, changePassword } from '../api/client'
import Modal from './Modal'
import logo from '../../Logo.png'

const NAV_ICONS = {
  activity: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8h2l2-5 3 10 2-7 2 4h3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  tickets: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v2a1.5 1.5 0 000 3v2a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1.5 1.5 0 000-3V4z" strokeLinejoin="round"/>
    </svg>
  ),
  deployments: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 11l6-8 6 8" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5" y="11" width="6" height="3" rx="0.5" strokeLinejoin="round"/>
      <path d="M8 7v4" strokeLinecap="round"/>
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
    </svg>
  ),
  assignments: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" /><path d="M1 13c0-2.761 2.239-4 5-4" strokeLinecap="round" />
      <circle cx="11" cy="5" r="2.5" /><path d="M10 9c2.761 0 5 1.239 5 4" strokeLinecap="round" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2a4 4 0 014 4v3l1 2H3l1-2V6a4 4 0 014-4z" /><path d="M6.5 13a1.5 1.5 0 003 0" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="5" r="2.5" /><path d="M1 14c0-2.761 1.791-4 4-4s4 1.239 4 4" strokeLinecap="round" />
      <path d="M11 7h4M13 5v4" strokeLinecap="round" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 8h8M11 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3H3a1 1 0 00-1 1v8a1 1 0 001 1h7" strokeLinecap="round" />
    </svg>
  ),
}

export default function Layout() {
  const { user, isManager, isAdmin, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwdLoading, setPwdLoading] = useState(false)

  const handleChangePwd = async (e) => {
    e.preventDefault()
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    if (pwdForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    setPwdLoading(true)
    try {
      await changePassword({ current_password: pwdForm.current_password, new_password: pwdForm.new_password })
      toast.success('Password changed successfully')
      setShowChangePwd(false)
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setPwdLoading(false)
    }
  }

  useEffect(() => {
    getNotifications()
      .then(({ data }) => setUnread((data || []).filter((n) => !n.is_read).length))
      .catch(() => {})

    const interval = setInterval(() => {
      getNotifications()
        .then(({ data }) => setUnread((data || []).filter((n) => !n.is_read).length))
        .catch(() => {})
    }, 30_000)

    return () => clearInterval(interval)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const dashPath = isManager ? '/dashboard/manager' : '/dashboard/user'
  const initials = (user?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logo} alt="Ethereal Informatics" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">Navigation</span>

          <NavLink to={dashPath} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.dashboard}</span>
            Dashboard
          </NavLink>

          {isManager && (
            <NavLink to="/tasks" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{NAV_ICONS.tasks}</span>
              Tasks
            </NavLink>
          )}

          {isManager && (
            <NavLink to="/tickets/zammad" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{NAV_ICONS.tickets}</span>
              Support Tickets
            </NavLink>
          )}

          <NavLink to="/assignments" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.assignments}</span>
            My Assignments
          </NavLink>

          <NavLink to="/teams" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.teams}</span>
            Teams
          </NavLink>

          {isManager && (
            <NavLink to="/deployments" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{NAV_ICONS.deployments}</span>
              Deployments
            </NavLink>
          )}

          {isManager && (
            <NavLink to="/activity" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{NAV_ICONS.activity}</span>
              Activity Log
            </NavLink>
          )}

          {isAdmin && (
            <>
              <span className="nav-section-label" style={{ marginTop: 8 }}>Admin</span>
              <NavLink to="/admin/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">{NAV_ICONS.users}</span>
                Users
              </NavLink>
              <NavLink to="/admin/banks" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 6l6-4 6 4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 6v6h10V6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 12V8M8 12V8M11 12V8" strokeLinecap="round"/>
                    <path d="M2 12h12" strokeLinecap="round"/>
                  </svg>
                </span>
                Banks
              </NavLink>
            </>
          )}

          <span className="nav-section-label" style={{ marginTop: 8 }}>Account</span>

          <NavLink to="/notifications" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{NAV_ICONS.notifications}</span>
            Notifications
            {unread > 0 && <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.username}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="logout-btn" onClick={() => setShowChangePwd(true)} title="Change password" style={{ marginRight: 4 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="7" width="8" height="7" rx="1" />
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 8h8M11 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 3H3a1 1 0 00-1 1v8a1 1 0 001 1h7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </aside>

      {showChangePwd && (
        <Modal title="Change Password" onClose={() => { setShowChangePwd(false); setPwdForm({ current_password: '', new_password: '', confirm_password: '' }) }}>
          <form onSubmit={handleChangePwd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                value={pwdForm.current_password}
                onChange={(e) => setPwdForm(f => ({ ...f, current_password: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                value={pwdForm.new_password}
                onChange={(e) => setPwdForm(f => ({ ...f, new_password: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                value={pwdForm.confirm_password}
                onChange={(e) => setPwdForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowChangePwd(false); setPwdForm({ current_password: '', new_password: '', confirm_password: '' }) }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={pwdLoading}>
                {pwdLoading ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Main ── */}
      <div className="main-area dot-grid">
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
