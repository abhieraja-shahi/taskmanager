import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getTasks, getAllAssignments } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const STATUSES = ['all', 'pending_acceptance', 'in_progress', 'under_review', 'approved', 'rejected']
const STATUS_LABELS = {
  all: 'All', pending_acceptance: 'Pending', in_progress: 'In Progress',
  under_review: 'Ready for Review', approved: 'Completed', rejected: 'Rejected',
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function dueClass(due, status) {
  if (!due || ['approved', 'completed', 'rejected'].includes(status)) return ''
  const diff = new Date(due) - Date.now()
  if (diff < 0) return 'due-overdue'
  if (diff < 86_400_000) return 'due-soon'
  return ''
}

function exportToCSV(tasks) {
  const headers = ['ID', 'Title', 'Status', 'Due Date', 'Start Date', 'Created']
  const rows = tasks.map((t) => [
    t.id,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    STATUS_LABELS[t.status] || t.status,
    t.due_date ? new Date(t.due_date).toLocaleDateString() : '',
    t.start_date ? new Date(t.start_date).toLocaleDateString() : '',
    t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasks_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportUserViewToCSV(groups) {
  const headers = ['User', 'Role', 'Task', 'Task Status', 'Assignment Status', 'Due Date']
  const rows = []
  groups.forEach(({ user, assignments }) => {
    assignments.forEach((a) => {
      rows.push([
        `"${user?.username ?? ''}"`,
        user?.role ?? '',
        `"${(a.task?.title || '').replace(/"/g, '""')}"`,
        STATUS_LABELS[a.task?.status] || a.task?.status || '',
        a.status,
        a.task?.due_date ? new Date(a.task.due_date).toLocaleDateString() : '',
      ])
    })
  })
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `user_assignments_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportManagerViewToCSV(groups) {
  const headers = ['Manager', 'Role', 'Task ID', 'Task', 'Status', 'Assignees', 'Due Date', 'Created']
  const rows = []
  groups.forEach(({ creator, tasks }) => {
    tasks.forEach((t) => {
      rows.push([
        `"${creator?.username ?? ''}"`,
        creator?.role ?? '',
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        STATUS_LABELS[t.status] || t.status,
        t.assignments?.length ?? 0,
        t.due_date ? new Date(t.due_date).toLocaleDateString() : '',
        t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
      ])
    })
  })
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `manager_tasks_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── View toggle icon components ──────────────────────────────────────────────
function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="4" x2="13" y2="4"/>
      <line x1="3" y1="8" x2="13" y2="8"/>
      <line x1="3" y1="12" x2="13" y2="12"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5"/>
      <path d="M1 13c0-2.5 2.2-4 5-4s5 1.5 5 4"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M14 13c0-1.8-1-3-2.5-3.5"/>
    </svg>
  )
}

function IconManager() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="4.5" r="2.5"/>
      <path d="M3 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/>
      <path d="M11 7.5l1.5 1.5-1.5 1.5"/>
      <path d="M13 9h-2.5"/>
    </svg>
  )
}

export default function Tasks() {
  const navigate  = useNavigate()
  const location  = useLocation()

  // Task view state
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('all')
  const [search, setSearch]       = useState('')
  const [dueFrom, setDueFrom]     = useState('')
  const [dueTo, setDueTo]         = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  // View mode: 'tasks' | 'users' | 'managers'
  const [viewMode, setViewMode]   = useState('tasks')

  // User view state
  const [allAssignments, setAllAssignments] = useState([])
  const [userViewLoading, setUserViewLoading] = useState(false)
  const [userSearch, setUserSearch]         = useState('')
  const [userStatusFilter, setUserStatus]   = useState('all')
  const [userCreatedFrom, setUserCreatedFrom] = useState('')
  const [userCreatedTo, setUserCreatedTo]     = useState('')
  const [collapsed, setCollapsed]           = useState({})

  // Manager view state
  const [managerTasks, setManagerTasks]           = useState([])
  const [managerViewLoading, setManagerViewLoading] = useState(false)
  const [managerSearch, setManagerSearch]           = useState('')
  const [managerStatusFilter, setManagerStatus]     = useState('all')
  const [managerDueFrom, setManagerDueFrom]         = useState('')
  const [managerDueTo, setManagerDueTo]             = useState('')
  const [managerCollapsed, setManagerCollapsed]     = useState({})

  // ── Load task view ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'tasks') return
    const params = {}
    if (statusFilter !== 'all') params.status = statusFilter
    if (dueFrom) params.due_from = dueFrom
    if (dueTo)   params.due_to   = dueTo
    setLoading(true)
    getTasks(params)
      .then(({ data }) => setTasks(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [viewMode, statusFilter, dueFrom, dueTo, location.key])

  // ── Load user view ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'users') return
    setUserViewLoading(true)
    getAllAssignments()
      .then(({ data }) => setAllAssignments(data || []))
      .catch(() => {})
      .finally(() => setUserViewLoading(false))
  }, [viewMode, location.key])

  // ── Load manager view ───────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'managers') return
    setManagerViewLoading(true)
    getTasks()
      .then(({ data }) => setManagerTasks(data || []))
      .catch(() => {})
      .finally(() => setManagerViewLoading(false))
  }, [viewMode, location.key])

  // ── Task view filtering ─────────────────────────────────────────────────────
  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false
    if (overdueOnly) {
      if (['approved', 'rejected'].includes(t.status)) return false
      if (!t.due_date || new Date(t.due_date) >= Date.now()) return false
    }
    return true
  })

  // ── User view grouping ──────────────────────────────────────────────────────
  const groupedByUser = useMemo(() => {
    const map = {}
    allAssignments.forEach((a) => {
      const uid = a.user_id
      if (!map[uid]) map[uid] = { user: a.user, assignments: [] }
      map[uid].assignments.push(a)
    })
    return Object.values(map)
      .map((g) => ({
        ...g,
        assignments: g.assignments.filter((a) => {
          if (userStatusFilter !== 'all' && a.status !== userStatusFilter) return false
          if (userCreatedFrom && a.task?.created_at) {
            if (new Date(a.task.created_at) < new Date(userCreatedFrom)) return false
          }
          if (userCreatedTo && a.task?.created_at) {
            if (new Date(a.task.created_at) > new Date(userCreatedTo + 'T23:59:59')) return false
          }
          return true
        }),
      }))
      .filter((g) => {
        if (g.assignments.length === 0) return false
        if (userSearch && !(g.user?.username || '').toLowerCase().includes(userSearch.toLowerCase())) return false
        return true
      })
      .sort((a, b) => (a.user?.username || '').localeCompare(b.user?.username || ''))
  }, [allAssignments, userSearch, userStatusFilter, userCreatedFrom, userCreatedTo])

  // ── Manager view grouping ───────────────────────────────────────────────────
  const groupedByManager = useMemo(() => {
    const map = {}
    managerTasks.forEach((t) => {
      const cid = t.created_by
      if (!map[cid]) map[cid] = { creator: t.creator ?? { id: cid, username: `User #${cid}`, role: '' }, tasks: [] }
      map[cid].tasks.push(t)
    })
    return Object.values(map)
      .map((g) => ({
        ...g,
        tasks: g.tasks.filter((t) => {
          if (managerStatusFilter !== 'all' && t.status !== managerStatusFilter) return false
          if (managerDueFrom && t.due_date) {
            if (new Date(t.due_date) < new Date(managerDueFrom)) return false
          }
          if (managerDueTo && t.due_date) {
            if (new Date(t.due_date) > new Date(managerDueTo + 'T23:59:59')) return false
          }
          return true
        }),
      }))
      .filter((g) => {
        if (g.tasks.length === 0) return false
        if (managerSearch && !(g.creator?.username || '').toLowerCase().includes(managerSearch.toLowerCase())) return false
        return true
      })
      .sort((a, b) => (a.creator?.username || '').localeCompare(b.creator?.username || ''))
  }, [managerTasks, managerSearch, managerStatusFilter, managerDueFrom, managerDueTo])

  const toggleCollapse = (uid) => setCollapsed((prev) => ({ ...prev, [uid]: !prev[uid] }))
  const toggleManagerCollapse = (mid) => setManagerCollapsed((prev) => ({ ...prev, [mid]: !prev[mid] }))

  const clearDates = () => { setDueFrom(''); setDueTo('') }

  const switchView = (mode) => {
    setViewMode(mode)
    setSearch('')
    setUserSearch('')
    setUserStatus('all')
    setUserCreatedFrom('')
    setUserCreatedTo('')
    setManagerSearch('')
    setManagerStatus('all')
    setManagerDueFrom('')
    setManagerDueTo('')
  }

  // ── View toggle control ─────────────────────────────────────────────────────
  const viewToggle = (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, rgba(255,255,255,0.05))', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
      <button
        title="Task list view"
        onClick={() => switchView('tasks')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
          border: 'none', cursor: 'pointer', fontSize: 12,
          background: viewMode === 'tasks' ? 'var(--surface-3, rgba(255,255,255,0.12))' : 'transparent',
          color: viewMode === 'tasks' ? 'var(--text-bright)' : 'var(--text-muted)',
          fontWeight: viewMode === 'tasks' ? 600 : 400,
        }}
      >
        <IconList /> Tasks
      </button>
      <button
        title="User assignment view"
        onClick={() => switchView('users')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
          border: 'none', cursor: 'pointer', fontSize: 12,
          background: viewMode === 'users' ? 'var(--surface-3, rgba(255,255,255,0.12))' : 'transparent',
          color: viewMode === 'users' ? 'var(--text-bright)' : 'var(--text-muted)',
          fontWeight: viewMode === 'users' ? 600 : 400,
        }}
      >
        <IconUsers /> By User
      </button>
      <button
        title="Manager view"
        onClick={() => switchView('managers')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6,
          border: 'none', cursor: 'pointer', fontSize: 12,
          background: viewMode === 'managers' ? 'var(--surface-3, rgba(255,255,255,0.12))' : 'transparent',
          color: viewMode === 'managers' ? 'var(--text-bright)' : 'var(--text-muted)',
          fontWeight: viewMode === 'managers' ? 600 : 400,
        }}
      >
        <IconManager /> By Manager
      </button>
    </div>
  )

  // ── Render user view ────────────────────────────────────────────────────────
  const renderUserView = () => {
    if (userViewLoading) {
      return <div className="loading"><div className="spinner" /><span>Loading assignments…</span></div>
    }
    if (groupedByUser.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">{userSearch ? 'No matching users' : 'No assignments found'}</div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groupedByUser.map(({ user, assignments }) => {
          const uid = user?.id ?? 0
          const isCollapsed = collapsed[uid]
          const pendingCount = assignments.filter((a) => a.status === 'pending').length

          return (
            <div key={uid} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  background: 'var(--surface-2, rgba(255,255,255,0.04))',
                  cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => toggleCollapse(uid)}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--color-purple-dim, rgba(139,92,246,0.2))',
                  border: '1px solid rgba(139,92,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--color-purple, #8b5cf6)',
                  flexShrink: 0,
                }}>
                  {(user?.username || '?')[0].toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13 }}>
                    {user?.username ?? `User #${uid}`}
                  </span>
                  <span style={{
                    marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 99,
                    background: 'var(--surface-3, rgba(255,255,255,0.08))',
                    color: 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}>
                    {user?.role ?? '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {assignments.length} task{assignments.length !== 1 ? 's' : ''}
                  </span>
                  {pendingCount > 0 && (
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 99,
                      background: 'var(--color-yellow-dim, rgba(234,179,8,0.15))',
                      color: 'var(--color-yellow, #eab308)',
                      border: '1px solid rgba(234,179,8,0.25)',
                    }}>
                      {pendingCount} pending
                    </span>
                  )}
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                  >
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </div>
              </div>

              {!isCollapsed && (
                <div className="table-wrap" style={{ margin: 0, borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Task Status</th>
                        <th>Assignment Status</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => {
                        const cls = dueClass(a.task?.due_date, a.task?.status)
                        return (
                          <tr
                            key={a.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/tasks/${a.task_id}`)}
                          >
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text-bright)', fontSize: 13 }}>
                                {a.task?.title ?? `Task #${a.task_id}`}
                              </div>
                            </td>
                            <td>
                              {a.task ? <StatusBadge status={a.task.status} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td><StatusBadge status={a.status} /></td>
                            <td>
                              <span className={cls} style={{ fontSize: 11 }}>
                                {formatDate(a.task?.due_date)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render manager view ─────────────────────────────────────────────────────
  const renderManagerView = () => {
    if (managerViewLoading) {
      return <div className="loading"><div className="spinner" /><span>Loading tasks…</span></div>
    }
    if (groupedByManager.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">{managerSearch ? 'No matching managers' : 'No tasks found'}</div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groupedByManager.map(({ creator, tasks: mgrTasks }) => {
          const mid = creator?.id ?? 0
          const isCollapsed = managerCollapsed[mid]
          const pendingCount = mgrTasks.filter((t) => t.status === 'pending_acceptance').length

          return (
            <div key={mid} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  background: 'var(--surface-2, rgba(255,255,255,0.04))',
                  cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => toggleManagerCollapse(mid)}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#3b82f6',
                  flexShrink: 0,
                }}>
                  {(creator?.username || '?')[0].toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13 }}>
                    {creator?.username ?? `User #${mid}`}
                  </span>
                  <span style={{
                    marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 99,
                    background: 'var(--surface-3, rgba(255,255,255,0.08))',
                    color: 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}>
                    {creator?.role ?? '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {mgrTasks.length} task{mgrTasks.length !== 1 ? 's' : ''}
                  </span>
                  {pendingCount > 0 && (
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 99,
                      background: 'var(--color-yellow-dim, rgba(234,179,8,0.15))',
                      color: 'var(--color-yellow, #eab308)',
                      border: '1px solid rgba(234,179,8,0.25)',
                    }}>
                      {pendingCount} pending
                    </span>
                  )}
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                  >
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </div>
              </div>

              {!isCollapsed && (
                <div className="table-wrap" style={{ margin: 0, borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Assignees</th>
                        <th>Due Date</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mgrTasks.map((t) => {
                        const cls = dueClass(t.due_date, t.status)
                        return (
                          <tr
                            key={t.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/tasks/${t.id}`)}
                          >
                            <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', width: 48 }}>
                              #{t.id}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text-bright)', fontSize: 13 }}>
                                {t.title}
                              </div>
                              {t.description && (
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.description}
                                </div>
                              )}
                            </td>
                            <td><StatusBadge status={t.status} /></td>
                            <td>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {t.assignments?.length
                                  ? t.assignments.map((a) => a.user?.username).filter(Boolean).join(', ') || '—'
                                  : '—'}
                              </span>
                            </td>
                            <td>
                              <span className={cls} style={{ fontSize: 11 }}>
                                {formatDate(t.due_date)}
                              </span>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {formatDate(t.created_at)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Tasks</div>
          <div className="page-subheading">
            {viewMode === 'tasks'
              ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`
              : viewMode === 'users'
              ? `${groupedByUser.length} user${groupedByUser.length !== 1 ? 's' : ''} · ${allAssignments.length} assignment${allAssignments.length !== 1 ? 's' : ''}`
              : `${groupedByManager.length} manager${groupedByManager.length !== 1 ? 's' : ''} · ${managerTasks.length} task${managerTasks.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {viewMode === 'tasks' ? (
            <button
              className="btn btn-secondary"
              onClick={() => exportToCSV(filtered)}
              disabled={filtered.length === 0}
              title="Export current view to Excel (CSV)"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v9M4 7l4 4 4-4"/><path d="M2 13h12"/>
              </svg>
              Export
            </button>
          ) : viewMode === 'users' ? (
            <button
              className="btn btn-secondary"
              onClick={() => exportUserViewToCSV(groupedByUser)}
              disabled={groupedByUser.length === 0}
              title="Export user assignments to CSV"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v9M4 7l4 4 4-4"/><path d="M2 13h12"/>
              </svg>
              Export
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => exportManagerViewToCSV(groupedByManager)}
              disabled={groupedByManager.length === 0}
              title="Export manager tasks to CSV"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v9M4 7l4 4 4-4"/><path d="M2 13h12"/>
              </svg>
              Export
            </button>
          )}
          {viewMode === 'tasks' && (
            <button className="btn btn-primary" onClick={() => navigate('/tasks/new')}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 1v8M1 5h8"/>
              </svg>
              New Task
            </button>
          )}
          {viewToggle}
        </div>
      </div>

      {/* ── Task view filters ── */}
      {viewMode === 'tasks' && (
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="search-input-wrap">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="form-control search-input"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Due:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              title="Due from"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              title="Due to"
            />
            {(dueFrom || dueTo) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11, height: 32 }}
                onClick={clearDates}
              >✕</button>
            )}
          </div>

          <button
            className="filter-pill"
            style={overdueOnly
              ? { background: 'var(--color-red-dim)', borderColor: 'rgba(220,38,38,0.35)', color: 'var(--color-red)' }
              : {}}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            Overdue
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`filter-pill${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* ── User view filters ── */}
      {viewMode === 'users' && (
        <div className="filter-bar" style={{ gap: 8 }}>
          <div className="search-input-wrap">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="form-control search-input"
              placeholder="Filter by username…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Created:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={userCreatedFrom}
              onChange={(e) => setUserCreatedFrom(e.target.value)}
              title="Created from"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={userCreatedTo}
              onChange={(e) => setUserCreatedTo(e.target.value)}
              title="Created to"
            />
            {(userCreatedFrom || userCreatedTo) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11, height: 32 }}
                onClick={() => { setUserCreatedFrom(''); setUserCreatedTo('') }}
              >✕</button>
            )}
          </div>

          {[
            { key: 'all',       label: 'All' },
            { key: 'pending',   label: 'Pending' },
            { key: 'accepted',  label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'rejected',  label: 'Declined' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`filter-pill${userStatusFilter === key ? ' active' : ''}`}
              onClick={() => setUserStatus(key)}
            >
              {label}
            </button>
          ))}
          {groupedByUser.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', height: 32 }}
                onClick={() => setCollapsed(Object.fromEntries(groupedByUser.map((g) => [g.user?.id, true])))}
              >
                Collapse all
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', height: 32 }}
                onClick={() => setCollapsed({})}
              >
                Expand all
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Manager view filters ── */}
      {viewMode === 'managers' && (
        <div className="filter-bar" style={{ gap: 8 }}>
          <div className="search-input-wrap">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="form-control search-input"
              placeholder="Filter by manager…"
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Due:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={managerDueFrom}
              onChange={(e) => setManagerDueFrom(e.target.value)}
              title="Due from"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 130, fontSize: 11, padding: '4px 8px', height: 32 }}
              value={managerDueTo}
              onChange={(e) => setManagerDueTo(e.target.value)}
              title="Due to"
            />
            {(managerDueFrom || managerDueTo) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: 11, height: 32 }}
                onClick={() => { setManagerDueFrom(''); setManagerDueTo('') }}
              >✕</button>
            )}
          </div>

          {STATUSES.map((s) => (
            <button
              key={s}
              className={`filter-pill${managerStatusFilter === s ? ' active' : ''}`}
              onClick={() => setManagerStatus(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
          {groupedByManager.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', height: 32 }}
                onClick={() => setManagerCollapsed(Object.fromEntries(groupedByManager.map((g) => [g.creator?.id, true])))}
              >
                Collapse all
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', height: 32 }}
                onClick={() => setManagerCollapsed({})}
              >
                Expand all
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {viewMode === 'tasks' ? (
        loading ? (
          <div className="loading"><div className="spinner" /><span>Loading tasks…</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">□</div>
            <div className="empty-title">No Tasks</div>
            <div className="empty-sub">{search ? 'No results match your search.' : 'Create a task to get started.'}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Assignees</th>
                  <th>Due Date</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${task.id}`)}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', width: 48 }}>
                      #{task.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-bright)' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {task.assignments?.length
                          ? task.assignments.map((a) => a.user?.username).filter(Boolean).join(', ') || '—'
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={dueClass(task.due_date, task.status)} style={{ fontSize: 11 }}>
                        {formatDate(task.due_date)}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {formatDate(task.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : viewMode === 'users' ? renderUserView() : renderManagerView()}
    </>
  )
}
