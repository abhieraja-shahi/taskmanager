import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyAssignments, getTask, acceptTask, rejectTask, completeTask } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../contexts/ToastContext'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dueClass(due, taskStatus) {
  if (!due || ['approved', 'rejected', 'completed'].includes(taskStatus)) return ''
  const diff = new Date(due) - Date.now()
  if (diff < 0) return 'due-overdue'
  if (diff < 86_400_000) return 'due-soon'
  return ''
}

export default function Assignments() {
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows]           = useState([]) // merged assignment + task data
  const [loading, setLoading]     = useState(true)
  const [rejectModal, setRejectModal] = useState(null)
  const [reason, setReason]       = useState('')
  const [filter, setFilter]       = useState('active')

  const load = async () => {
    setLoading(true)
    try {
      const { data: assignments } = await getMyAssignments()
      // Fetch task details for each assignment in parallel
      const taskFetches = [...new Set((assignments || []).map((a) => a.task_id))].map((id) =>
        getTask(id).then(({ data }) => data).catch(() => null)
      )
      const tasks = await Promise.all(taskFetches)
      const taskMap = {}
      tasks.forEach((t) => { if (t) taskMap[t.id] = t })

      const merged = (assignments || []).map((a) => ({
        ...a,
        task: taskMap[a.task_id] || null,
      }))
      setRows(merged)
    } catch {
      toast.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAccept = async (taskId) => {
    try { await acceptTask(taskId); toast.success('Task accepted.'); load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    try {
      await rejectTask(rejectModal.taskId, { reason })
      toast.success('Task declined.')
      setRejectModal(null); setReason('')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleComplete = async (taskId) => {
    try { await completeTask(taskId); toast.success('Marked as ready for review.'); load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const active    = rows.filter((r) => ['pending', 'accepted'].includes(r.status))
  const completed = rows.filter((r) => r.status === 'completed')
  const rejected  = rows.filter((r) => r.status === 'rejected')

  const displayed = filter === 'active' ? active : filter === 'completed' ? completed : rejected

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">My Assignments</div>
          <div className="page-subheading">{rows.length} total assignment{rows.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'active',    label: `Active (${active.length})` },
          { key: 'completed', label: `Completed (${completed.length})` },
          { key: 'rejected',  label: `Declined (${rejected.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`filter-pill${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading assignments…</span></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">
            No {filter === 'active' ? 'Active' : filter === 'completed' ? 'Completed' : 'Declined'} Assignments
          </div>
          <div className="empty-sub">
            {filter === 'active' ? 'No tasks are currently assigned to you.' : ''}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Task Status</th>
                <th>My Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((row) => {
                const task = row.task
                const cls  = dueClass(task?.due_date, task?.status)
                return (
                  <tr key={row.id}>
                    <td>
                      <div
                        style={{ fontWeight: 500, color: 'var(--text-bright)', cursor: 'pointer' }}
                        onClick={() => navigate(`/tasks/${row.task_id}`)}
                      >
                        {task?.title ?? `Task #${row.task_id}`}
                      </div>
                      {task?.description && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {task ? <StatusBadge status={task.status} /> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <span className={cls} style={{ fontSize: 11 }}>
                        {formatDate(task?.due_date)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {row.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleAccept(row.task_id)}>Accept</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setRejectModal({ taskId: row.task_id })}>Decline</button>
                          </>
                        )}
                        {row.status === 'accepted' && task?.status === 'in_progress' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleComplete(row.task_id)}>Ready for Review</button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/tasks/${row.task_id}`)}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRejectModal(null)}>
          <div className="modal">
            <div className="modal-title">Decline Assignment</div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea
                className="form-control"
                placeholder="Explain why you're declining…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setRejectModal(null); setReason('') }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={!reason.trim()}>Decline</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
