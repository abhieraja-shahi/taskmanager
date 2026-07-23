import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getTask, acceptTask, rejectTask, completeTask, reviewTask,
  getTaskComments, addComment, getTaskActivity,
  updateTask, reassignTask, getTeams, getZammadTickets, getBanks,
  getTaskAttachments, uploadTaskAttachment, downloadAttachment, deleteAttachment,
} from '../api/client'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

function formatDate(d, includeTime = false) {
  if (!d) return '—'
  const opts = { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' }
  if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit' }
  return new Date(d).toLocaleDateString('en-US', opts)
}

function toInputDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T')
}

function dueLabel(due, status) {
  if (!due || ['approved', 'completed', 'rejected'].includes(status)) return null
  const diff = new Date(due) - Date.now()
  if (diff < 0) return { text: 'Overdue', cls: 'due-overdue' }
  if (diff < 86_400_000) return { text: 'Due Today', cls: 'due-soon' }
  return null
}

const TABS = ['Details', 'Attachments', 'Comments', 'Activity']

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isManager, isAdmin } = useAuth()
  const toast = useToast()

  const [task, setTask]             = useState(null)
  const [comments, setComments]     = useState([])
  const [activity, setActivity]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('Details')
  const [commentText, setComment]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading]     = useState(false)

  // Modals
  const [rejectModal, setRejectModal]     = useState(false)
  const [reviewModal, setReviewModal]     = useState(false)
  const [editModal, setEditModal]         = useState(false)
  const [reassignModal, setReassignModal] = useState(false)
  const [reason, setReason]               = useState('')
  const [reviewApproved, setReviewApp]    = useState(true)
  const [reviewComment, setReviewComment] = useState('')

  // Edit form
  const [editForm, setEditForm] = useState({ title: '', description: '', due_date: '', start_date: '', bank_ids: [] })
  const [editFiles, setEditFiles] = useState([])
  const [allBanks, setAllBanks] = useState([])
  const [bankSearch, setBankSearch] = useState('')

  // Reassign
  const [teams, setTeams]           = useState([])
  const [selectedIds, setSelectedIds] = useState([])

  // Linked ticket
  const [linkedTicket, setLinkedTicket] = useState(null)

  const loadAll = () => {
    return Promise.all([
      getTask(id),
      getTaskComments(id),
      getTaskActivity(id),
      getTaskAttachments(id),
    ]).then(([t, c, a, att]) => {
      setTask(t.data)
      setComments(c.data || [])
      setActivity(a.data || [])
      setAttachments(att.data || [])
    }).catch(() => toast.error('Failed to load task'))
  }

  useEffect(() => {
    setLoading(true)
    loadAll().finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!task?.zammad_ticket_id) { setLinkedTicket(null); return }
    getZammadTickets()
      .then(({ data }) => {
        const found = (data || []).find((t) => t.ticket_id === task.zammad_ticket_id)
        setLinkedTicket(found || null)
      })
      .catch(() => {})
  }, [task?.zammad_ticket_id])

  const myAssignment = task?.assignments?.find((a) => a.user_id === user?.id)

  const handleAccept = async () => {
    try { await acceptTask(id); toast.success('Task accepted.'); loadAll() }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    try {
      await rejectTask(id, { reason })
      toast.success('Task declined.')
      setRejectModal(false); setReason('')
      loadAll()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleComplete = async () => {
    try { await completeTask(id); toast.success('Marked as ready for review.'); loadAll() }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleReview = async () => {
    try {
      await reviewTask(id, { approved: reviewApproved, comment: reviewComment || undefined })
      toast.success(reviewApproved ? 'Task marked as completed.' : 'Sent back for revision.')
      setReviewModal(false); setReviewApp(true); setReviewComment('')
      loadAll()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const handleComment = async () => {
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      const { data } = await addComment(id, { content: commentText })
      setComments((prev) => [...prev, data])
      setComment('')
    } catch (e) { toast.error('Failed to post comment') }
    finally { setSubmitting(false) }
  }

  // ── Edit task ──
  const openEdit = () => {
    setEditForm({
      title:       task.title || '',
      description: task.description || '',
      due_date:    toInputDate(task.due_date),
      start_date:  toInputDate(task.start_date),
      bank_ids:    task.banks?.map((b) => b.id) || [],
    })
    setBankSearch('')
    setEditFiles([])
    getBanks().then(({ data }) => setAllBanks(data || [])).catch(() => {})
    setEditModal(true)
  }

  const handleEdit = async () => {
    if (!editForm.title.trim()) return toast.error('Title is required.')
    if (!editForm.due_date)     return toast.error('Due date is required.')
    const dueDate = new Date(editForm.due_date)
    if (task.created_at && dueDate <= new Date(task.created_at))
      return toast.error('Due date must be after the task creation date.')
    if (editForm.start_date && dueDate <= new Date(editForm.start_date))
      return toast.error('Due date must be after the start date.')
    try {
      const payload = {
        title:       editForm.title,
        description: editForm.description || null,
        due_date:    new Date(editForm.due_date).toISOString(),
        start_date:  editForm.start_date ? new Date(editForm.start_date).toISOString() : null,
        bank_ids:    editForm.bank_ids,
      }
      await updateTask(id, payload)
      for (const file of editFiles) {
        try { await uploadTaskAttachment(id, file) }
        catch { toast.error(`Failed to upload ${file.name}`) }
      }
      toast.success('Task updated.')
      setEditModal(false)
      loadAll()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update task') }
  }

  // ── Reassign ──
  const openReassign = async () => {
    try {
      const { data } = await getTeams()
      setTeams(data || [])
      setSelectedIds(task.assignments?.map((a) => a.user_id) || [])
      setReassignModal(true)
    } catch { toast.error('Failed to load teams') }
  }

  const availableUsers = (() => {
    const seen = new Map()
    const myTeams = isAdmin ? teams : teams.filter((t) => t.managers?.some((m) => m.user_id === user?.id))
    // Always include self for self-assignment
    if (!isAdmin && user) {
      seen.set(user.id, { id: user.id, username: user.username })
    }
    myTeams.forEach((team) => {
      team.members?.forEach((m) => {
        if (!isAdmin && m.user?.role === 'admin') return  // admins are not task assignees
        if (!seen.has(m.user_id)) {
          seen.set(m.user_id, {
            id: m.user_id,
            username: m.user?.username || `User #${m.user_id}`,
          })
        }
      })
    })
    return [...seen.values()]
  })()

  const toggleUser = (uid) => {
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    )
  }

  const handleReassign = async () => {
    if (selectedIds.length === 0) return toast.error('Select at least one assignee.')
    try {
      await reassignTask(id, { assignee_ids: selectedIds })
      toast.success('Assignees updated.')
      setReassignModal(false)
      loadAll()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to reassign task') }
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>Loading task…</span></div>
  if (!task)   return <div className="empty-state"><div className="empty-title">Task Not Found</div></div>

  const dl = dueLabel(task.due_date, task.status)
  const canEdit = isManager && task.status !== 'approved' && task.status !== 'rejected'

  return (
    <>
      <button className="back-link" onClick={() => navigate(-1)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2L4 6l4 4"/>
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-title">{task.title}</div>
        <div className="detail-actions">
          {/* Manager edit/reassign */}
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={openEdit}>Edit</button>
              <button className="btn btn-secondary" onClick={openReassign}>Reassign</button>
            </>
          )}
          {/* User actions */}
          {myAssignment?.status === 'pending' && (
            <>
              <button className="btn btn-success" onClick={handleAccept}>Accept</button>
              <button className="btn btn-danger" onClick={() => setRejectModal(true)}>Decline</button>
            </>
          )}
          {myAssignment?.status === 'accepted' && task.status === 'in_progress' && (
            <button className="btn btn-primary" onClick={handleComplete}>Mark Ready for Review</button>
          )}
          {/* Manager review */}
          {isManager && task.status === 'under_review' && (
            <button className="btn btn-primary" onClick={() => setReviewModal(true)}>Review</button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="info-row">
        <StatusBadge status={task.status} />
        <span className="info-sep">·</span>
        <span>#{task.id}</span>
        <span className="info-sep">·</span>
        <span>Created {formatDate(task.created_at)}{task.creator ? ` by ${task.creator.username}` : ''}</span>
        {task.started_at && (
          <><span className="info-sep">·</span><span>Started {formatDate(task.started_at)}</span></>
        )}
        {task.completed_at && (
          <><span className="info-sep">·</span>
          <span>
            Completed {formatDate(task.completed_at)}{task.reviewer ? ` by ${task.reviewer.username}` : ''}
          </span></>
        )}
        {dl && (
          <><span className="info-sep">·</span><span className={dl.cls}>{dl.text}</span></>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Comments' && comments.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 9, background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 8 }}>
                {comments.length}
              </span>
            )}
            {t === 'Attachments' && attachments.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 9, background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 8 }}>
                {attachments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DETAILS TAB ── */}
      {tab === 'Details' && (
        <div className="grid-2" style={{ gap: 16 }}>
          <div>
            <div className="section-label">Description</div>
            {task.description ? (
              <div className="desc-block">{task.description}</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                No description provided.
              </div>
            )}

            {task.start_date && (
              <>
                <div className="section-label" style={{ marginTop: 20 }}>Start Date</div>
                <div className="desc-block" style={{ fontSize: 13 }}>
                  {formatDate(task.start_date, false)}
                </div>
              </>
            )}

            <div className="section-label" style={{ marginTop: 20 }}>Due Date</div>
            <div className={`desc-block ${dl?.cls || ''}`} style={{ fontSize: 13 }}>
              {formatDate(task.due_date, true)}
            </div>

            {task.banks?.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 20 }}>Banks</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {task.banks.map((b) => (
                    <span key={b.id} style={{
                      fontSize: 11, padding: '4px 10px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    }}>
                      {b.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {task.zammad_ticket_id && (
              <>
                <div className="section-label" style={{ marginTop: 20 }}>Linked Ticket</div>
                <div
                  className="desc-block"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    border: '1px solid var(--color-cyan)',
                  }}
                  onClick={() => navigate('/tickets/zammad')}
                  title="View in Support Tickets"
                >
                  {linkedTicket ? (
                    <>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-cyan)', whiteSpace: 'nowrap' }}>
                        #{linkedTicket.number}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {linkedTicket.title}
                      </span>
                      <span className={`status-badge status-${(linkedTicket.state || '').toLowerCase().replace(/ /g, '_')}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <span className="status-dot" />
                        {linkedTicket.state}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ticket #{task.zammad_ticket_id}</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <div className="section-label">Assignees ({task.assignments?.length ?? 0})</div>
            {task.assignments?.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No assignees.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {task.assignments?.map((a) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div className="avatar">
                      {(a.user?.username || `U${a.user_id}`).slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-bright)' }}>
                        {a.user?.username || `User #${a.user_id}`}
                      </div>
                      {a.rejection_reason && (
                        <div style={{ fontSize: 10, color: 'var(--color-red)', marginTop: 2 }}>
                          Reason: {a.rejection_reason}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTACHMENTS TAB ── */}
      {tab === 'Attachments' && (
        <div>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="file"
              id="attachment-input"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 25 * 1024 * 1024) {
                  toast.error('File too large. Maximum size is 25 MB.')
                  e.target.value = ''
                  return
                }
                setUploading(true)
                try {
                  const { data } = await uploadTaskAttachment(id, file)
                  setAttachments((prev) => [data, ...prev])
                  toast.success('File uploaded.')
                } catch (err) {
                  toast.error(err.response?.data?.detail || 'Upload failed')
                } finally {
                  setUploading(false)
                  e.target.value = ''
                }
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => document.getElementById('attachment-input').click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload File'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max 25 MB</span>
          </div>

          {attachments.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-title">No Attachments</div>
              <div className="empty-sub">Upload files to this task.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attachments.map((att) => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.filename}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatFileSize(att.file_size)}
                      {att.uploader ? ` · ${att.uploader.username}` : ''}
                      {' · '}{formatDate(att.uploaded_at, true)}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      try {
                        const { data } = await downloadAttachment(att.id)
                        const url = URL.createObjectURL(data)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = att.filename
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch { toast.error('Download failed') }
                    }}
                  >
                    Download
                  </button>
                  {(att.uploaded_by === user?.id || isManager || isAdmin) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        try {
                          await deleteAttachment(att.id)
                          setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                          toast.success('Attachment deleted.')
                        } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed') }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COMMENTS TAB ── */}
      {tab === 'Comments' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div className="form-group">
              <textarea
                className="form-control"
                placeholder="Add a comment…"
                value={commentText}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleComment}
              disabled={submitting || !commentText.trim()}
            >
              {submitting ? 'Posting…' : 'Post Comment'}
            </button>
          </div>

          {comments.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-title">No Comments</div>
              <div className="empty-sub">Be the first to comment.</div>
            </div>
          ) : (
            <div>
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div className="avatar">{(c.user?.username || `U${c.user_id}`).slice(0, 2).toUpperCase()}</div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <span className="comment-author">{c.user?.username || `User #${c.user_id}`}</span>
                      <span className="comment-time">{formatDate(c.created_at, true)}</span>
                    </div>
                    <div className="comment-text">{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === 'Activity' && (
        <div>
          {activity.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-title">No Activity</div>
            </div>
          ) : (
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16, marginLeft: 8 }}>
              {activity.map((a) => (
                <div key={a.id} className="activity-item">
                  <div style={{ position: 'absolute', left: -20 }}>
                    <div className="activity-dot" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="activity-action">
                      {a.user?.username && (
                        <span style={{ color: 'var(--text-bright)', fontWeight: 600, marginRight: 6 }}>
                          {a.user.username}
                        </span>
                      )}
                      {a.action}
                    </div>
                    {a.detail && <div className="activity-detail">{a.detail}</div>}
                  </div>
                  <div className="activity-time">{formatDate(a.timestamp, true)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── REJECT MODAL ── */}
      {rejectModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRejectModal(false)}>
          <div className="modal">
            <div className="modal-title">Decline Task</div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setRejectModal(false); setReason('') }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={!reason.trim()}>Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW MODAL ── */}
      {reviewModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReviewModal(false)}>
          <div className="modal">
            <div className="modal-title">Review Task</div>
            <div className="form-group">
              <label className="form-label">Decision</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${reviewApproved ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => setReviewApp(true)}
                >Mark Complete</button>
                <button
                  className={`btn ${!reviewApproved ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setReviewApp(false)}
                >Request Changes</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Comment (optional)</label>
              <textarea className="form-control" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReviewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReview}>Submit Review</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">Edit Task</div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-control"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Attachments
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(optional, max 25 MB each)</span>
              </label>
              <input
                type="file"
                id="edit-file-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 25 * 1024 * 1024) {
                    toast.error('File too large. Maximum size is 25 MB.')
                  } else {
                    setEditFiles((prev) => [...prev, file])
                  }
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => document.getElementById('edit-file-input').click()}
                style={{ marginBottom: editFiles.length > 0 ? 8 : 0 }}
              >
                Add File
              </button>
              {editFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editFiles.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {f.size < 1024 * 1024 ? (f.size / 1024).toFixed(1) + ' KB' : (f.size / (1024 * 1024)).toFixed(1) + ' MB'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditFiles((prev) => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            {allBanks.length > 0 && (
              <div className="form-group">
                <label className="form-label">Banks</label>
                {editForm.bank_ids.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {editForm.bank_ids.map((bid) => {
                      const bank = allBanks.find((b) => b.id === bid)
                      if (!bank) return null
                      return (
                        <span key={bid} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, padding: '4px 8px',
                          background: 'var(--bg-elevated)', border: '1px solid var(--color-cyan)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                        }}>
                          {bank.name}
                          <span
                            onClick={() => setEditForm((f) => ({ ...f, bank_ids: f.bank_ids.filter((x) => x !== bid) }))}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, marginLeft: 2 }}
                          >×</span>
                        </span>
                      )
                    })}
                  </div>
                )}
                <input
                  className="form-control"
                  placeholder="Search banks..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                />
                {bankSearch && (
                  <div className="multi-select-wrap" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
                    {allBanks.filter((b) => !editForm.bank_ids.includes(b.id) && b.name.toLowerCase().includes(bankSearch.toLowerCase())).map((bank) => (
                      <div
                        key={bank.id}
                        className="multi-select-item"
                        onClick={() => { setEditForm((f) => ({ ...f, bank_ids: [...f.bank_ids, bank.id] })); setBankSearch('') }}
                      >
                        <div style={{ fontSize: 12 }}>{bank.name}</div>
                      </div>
                    ))}
                    {allBanks.filter((b) => !editForm.bank_ids.includes(b.id) && b.name.toLowerCase().includes(bankSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>No banks match your search.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REASSIGN MODAL ── */}
      {reassignModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReassignModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-title">Manage Assignees</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select users to assign this task to. Pending assignments not selected will be removed.
            </div>
            {availableUsers.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
                No team members available.
              </div>
            ) : (
              <div className="multi-select-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {availableUsers.map((u) => {
                  const sel = selectedIds.includes(u.id)
                  const existing = task.assignments?.find((a) => a.user_id === u.id)
                  return (
                    <div
                      key={u.id}
                      className={`multi-select-item${sel ? ' selected' : ''}`}
                      onClick={() => toggleUser(u.id)}
                    >
                      <div className="multi-select-check">{sel ? '✓' : ''}</div>
                      <div style={{ flex: 1 }}>
                        <div>{u.username}</div>
                        {existing && (
                          <div style={{ fontSize: 10, opacity: 0.6 }}>
                            Current: <StatusBadge status={existing.status} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReassignModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleReassign}
                disabled={selectedIds.length === 0}
              >
                Update Assignees
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
