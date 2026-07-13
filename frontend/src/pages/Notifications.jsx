import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client'
import { useToast } from '../contexts/ToastContext'

const TYPE_ICONS = {
  ASSIGNED:        '◆',
  ACCEPTED:        '✓',
  REJECTED:        '✕',
  COMPLETED:       '●',
  APPROVED:        '★',
  DUE_SOON:        '◐',
  OVERDUE:         '⚠',
  REVIEW_NEEDED:   '◎',
  COMMENTED:       '◉',
}

function formatDate(d) {
  if (!d) return ''
  const now = Date.now()
  const diff = now - new Date(d)
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Notifications() {
  const navigate = useNavigate()
  const toast = useToast()
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  const load = () => {
    setLoading(true)
    getNotifications()
      .then(({ data }) => setNotifs(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const unread = notifs.filter((n) => !n.is_read)
  const displayed = filter === 'unread' ? unread : notifs

  const handleClick = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id).catch(() => {})
      setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
    }
    if (n.task_id) navigate(`/tasks/${n.task_id}`)
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read.')
    } catch { toast.error('Failed to mark all read') }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Notifications</div>
          <div className="page-subheading">
            {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
          </div>
        </div>
        {unread.length > 0 && (
          <button className="btn btn-secondary" onClick={handleMarkAll}>Mark All Read</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`filter-pill${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          All ({notifs.length})
        </button>
        <button className={`filter-pill${filter === 'unread' ? ' active' : ''}`} onClick={() => setFilter('unread')}>
          Unread ({unread.length})
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading…</span></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">{filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}</div>
          <div className="empty-sub">You're all caught up.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {displayed.map((n) => (
            <div
              key={n.id}
              className={`notif-item${!n.is_read ? ' unread' : ''}`}
              style={{ position: 'relative', cursor: n.task_id ? 'pointer' : 'default' }}
              onClick={() => handleClick(n)}
            >
              {!n.is_read && <div className="notif-dot" style={{ flexShrink: 0 }} />}
              {n.is_read && <div style={{ width: 6, flexShrink: 0 }} />}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    fontSize: 12,
                    color: 'var(--color-amber)',
                    opacity: n.is_read ? 0.5 : 1,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {TYPE_ICONS[n.type] || '◆'}
                  </span>
                  <div>
                    <div className="notif-msg" style={{ opacity: n.is_read ? 0.6 : 1 }}>{n.message}</div>
                    <div className="notif-time">{formatDate(n.created_at)}</div>
                  </div>
                </div>
              </div>

              {n.task_id && (
                <div style={{
                  fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', padding: '2px 6px',
                  borderRadius: 4, flexShrink: 0, alignSelf: 'center',
                }}>
                  VIEW
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
