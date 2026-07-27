import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getManagerDashboard } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import { useAuth } from '../contexts/AuthContext'

const STATUS_FILTERS = ['all', 'pending_acceptance', 'in_progress', 'under_review', 'approved', 'rejected']
const STATUS_LABELS  = {
  all: 'All', pending_acceptance: 'Pending', in_progress: 'In Progress',
  under_review: 'Ready for Review', approved: 'Completed', rejected: 'Rejected',
}

const PAGE_SIZE = 25

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })
}

function dueClass(due) {
  if (!due) return ''
  const diff = new Date(due) - Date.now()
  if (diff < 0) return 'due-overdue'
  if (diff < 86_400_000) return 'due-soon'
  return ''
}

function Stats({ activeCount, inProgressCount, pendingCount, overdueCount, overdueOnly, onOverdueClick }) {
  return (
    <div className="stat-grid">
      {[
        { label: 'Active Tasks',    value: activeCount,     accent: 'var(--color-amber)' },
        { label: 'In Progress',     value: inProgressCount, accent: 'var(--color-cyan)' },
        { label: 'Awaiting Accept', value: pendingCount,    accent: 'var(--color-purple)' },
        { label: 'Overdue',         value: overdueCount,    accent: 'var(--color-red)', onClick: onOverdueClick, active: overdueOnly },
      ].map(({ label, value, accent, onClick, active }) => (
        <div
          className="stat-card"
          key={label}
          style={{ '--accent-color': accent, cursor: onClick ? 'pointer' : 'default', outline: active ? '2px solid var(--color-red)' : 'none' }}
          onClick={onClick}
          title={onClick ? (active ? 'Clear overdue filter' : 'Show overdue tasks only') : undefined}
        >
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function ManagerDashboard() {
  const { user, login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [tasks, setTasks]         = useState([])
  const [total, setTotal]         = useState(0)
  const [stats, setStats]         = useState({ active: 0, inProgress: 0, pending: 0, overdue: 0 })
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('all')
  const [search, setSearch]       = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage]           = useState(1)

  useEffect(() => {
    const params = {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }
    if (statusFilter !== 'all') params.status = statusFilter
    setLoading(true)
    getManagerDashboard(params)
      .then(({ data }) => {
        setTasks(data.items || [])
        setTotal(data.total || 0)
        setStats({
          active:     data.active_count     ?? 0,
          inProgress: data.in_progress_count ?? 0,
          pending:    data.pending_count     ?? 0,
          overdue:    data.overdue_count     ?? 0,
        })
        if (user?.username === 'Loading…') {
          login(localStorage.getItem('token'), { ...user, role: 'manager' })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter, page, location.key])

  // Reset to page 1 when filter changes
  const handleStatus = (s) => { setStatus(s); setPage(1) }
  const handleOverdue = () => { setOverdueOnly((v) => !v); setPage(1) }

  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (overdueOnly) {
      if (['approved', 'rejected'].includes(t.status)) return false
      if (!t.due_date || new Date(t.due_date) >= Date.now()) return false
    }
    return true
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Manager Dashboard</div>
          <div className="page-subheading">Overview of all tasks under your supervision</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/tasks/new')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Task
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading tasks…</span></div>
      ) : (
        <>
          <Stats
            activeCount={stats.active}
            inProgressCount={stats.inProgress}
            pendingCount={stats.pending}
            overdueCount={stats.overdue}
            overdueOnly={overdueOnly}
            onOverdueClick={handleOverdue}
          />

          <div className="filter-bar">
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
            <button
              className="filter-pill"
              style={overdueOnly
                ? { background: 'var(--color-red-dim)', borderColor: 'rgba(220,38,38,0.35)', color: 'var(--color-red)' }
                : {}}
              onClick={handleOverdue}
            >
              Overdue
            </button>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`filter-pill${statusFilter === s ? ' active' : ''}`}
                onClick={() => handleStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">□</div>
              <div className="empty-title">No Tasks Found</div>
              <div className="empty-sub">
                {search ? 'No tasks match your search.' : 'No tasks in this status.'}
              </div>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assignees</th>
                      <th>Due Date</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((task) => (
                      <tr
                        key={task.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      >
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-bright)', marginBottom: 2 }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.description.replace(/<[^>]*>/g, '')}
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
                          <span className={`tag ${dueClass(task.due_date)}`} style={{ borderColor: 'transparent', background: 'transparent', padding: 0 }}>
                            {formatDate(task.due_date)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {formatDate(task.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPage={setPage} />
            </>
          )}
        </>
      )}
    </>
  )
}
