import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserDashboard, getTask, acceptTask, rejectTask, completeTask } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(due) {
  return due && new Date(due) < Date.now()
}

function TaskRow({ task, onAction }) {
  const navigate = useNavigate()
  const overdue = isOverdue(task.due_date) && !['approved', 'completed', 'rejected', 'under_review'].includes(task.status)

  return (
    <div
      className="task-card"
      onClick={() => navigate(`/tasks/${task.id}`)}
      style={overdue ? { borderColor: 'rgba(239, 68, 68, 0.2)' } : {}}
    >
      <div className="task-card-body">
        <div className="task-card-title">
          {task.title}
          {overdue && (
            <span
              className="status-badge status-rejected"
              style={{ marginLeft: 8, fontSize: 9 }}
            >
              OVERDUE
            </span>
          )}
        </div>
        <div className="task-card-meta">
          <StatusBadge status={task.status} />
          <span>Due {formatDate(task.due_date)}</span>
        </div>
      </div>
      <div className="task-card-actions" onClick={(e) => e.stopPropagation()}>
        {task.my_assignment_status === 'pending' && (
          <>
            <button className="btn btn-success btn-sm" onClick={() => onAction('accept', task.id)}>
              Accept
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onAction('reject', task.id)}>
              Decline
            </button>
          </>
        )}
        {task.my_assignment_status === 'accepted' && task.status === 'in_progress' && (
          <button className="btn btn-primary btn-sm" onClick={() => onAction('complete', task.id)}>
            Mark Ready for Review
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/tasks/${task.id}`)}
        >
          View
        </button>
      </div>
    </div>
  )
}

export default function UserDashboard() {
  const toast = useToast()
  const { user } = useAuth()
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [rejectModal, setRejectModal] = useState(null)
  const [reason, setReason]     = useState('')

  const load = () => {
    setLoading(true)
    getUserDashboard()
      .then(({ data }) => setTasks(data || []))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAction = async (action, taskId) => {
    if (action === 'reject') { setRejectModal({ taskId }); return }
    try {
      if (action === 'accept')   await acceptTask(taskId)
      if (action === 'complete') await completeTask(taskId)
      toast.success(action === 'accept' ? 'Task accepted.' : 'Marked as ready for review.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed')
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    try {
      await rejectTask(rejectModal.taskId, { reason })
      toast.success('Task declined.')
      setRejectModal(null); setReason('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to decline')
    }
  }

  const overdue = tasks.filter((t) => isOverdue(t.due_date))
  const active  = tasks.filter((t) => !isOverdue(t.due_date))

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">My Dashboard</div>
          <div className="page-subheading">
            Welcome back, <span style={{ color: 'var(--color-amber)' }}>{user?.username}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <>
          <div className="stat-grid">
            {[
              { label: 'Active Tasks', value: active.length, accent: 'var(--color-cyan)' },
              { label: 'Overdue',      value: overdue.length, accent: 'var(--color-red)' },
            ].map(({ label, value, accent }) => (
              <div className="stat-card" key={label} style={{ '--accent-color': accent, maxWidth: 200 }}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
              </div>
            ))}
          </div>

          {overdue.length > 0 && (
            <>
              <div className="alert alert-error">
                <span>⚠</span>
                You have {overdue.length} overdue task{overdue.length !== 1 ? 's' : ''} requiring immediate attention.
              </div>
              <div className="section-label">Overdue</div>
              <div className="task-list" style={{ marginBottom: 28 }}>
                {overdue.map((t) => (
                  <TaskRow key={t.id} task={t} onAction={handleAction} />
                ))}
              </div>
            </>
          )}

          <div className="section-label">Active Tasks</div>
          {active.length === 0 && overdue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <div className="empty-title">All Clear</div>
              <div className="empty-sub">No active tasks assigned to you.</div>
            </div>
          ) : active.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>
              No non-overdue tasks.
            </div>
          ) : (
            <div className="task-list">
              {active.map((t) => (
                <TaskRow key={t.id} task={t} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRejectModal(null)}>
          <div className="modal">
            <div className="modal-title">Decline Task</div>
            <div className="form-group">
              <label className="form-label">Reason for declining *</label>
              <textarea
                className="form-control"
                placeholder="Provide a reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setRejectModal(null); setReason('') }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={!reason.trim()}>Decline Task</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
