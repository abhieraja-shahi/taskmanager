import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getZammadTickets, getTicketTasks } from '../api/client'

const PRIORITY_COLORS = {
  '1 low':      'var(--text-muted)',
  '2 normal':   'var(--color-cyan)',
  '3 high':     'var(--color-amber)',
  '4 urgent':   'var(--color-red)',
}

const STATE_FILTERS = [
  { key: '',       label: 'All' },
  { key: 'new',    label: 'New' },
  { key: 'open',   label: 'Open' },
  { key: 'closed', label: 'Closed' },
]

const STATUS_LABELS = {
  pending_acceptance: 'Pending',
  in_progress:        'In Progress',
  under_review:       'Ready for Review',
  approved:           'Completed',
  rejected:           'Rejected',
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function PriorityBadge({ priority }) {
  if (!priority) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const color = PRIORITY_COLORS[priority.toLowerCase()] || 'var(--text-secondary)'
  const label = priority.replace(/^\d\s/, '')
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
}

function LinkedTasks({ ticketId }) {
  const navigate = useNavigate()
  const [tasks, setTasks]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTicketTasks(ticketId)
      .then(({ data }) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [ticketId])

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      marginBottom: 6,
    }}>
      {/* Ticket body if any is handled by parent; this is just for tasks */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Linked Tasks
        </span>
        <button
          className="btn btn-primary"
          style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
          onClick={() => navigate(`/tasks/new?ticketId=${ticketId}`)}
        >
          + New Task
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tasks linked to this ticket yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tasks.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/tasks/${t.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', cursor: 'pointer',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>#{t.id}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </span>
              <span className={`status-badge status-${(t.status || '').toLowerCase()}`} style={{ flexShrink: 0 }}>
                <span className="status-dot" />
                {STATUS_LABELS[t.status] || t.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ZammadTickets() {
  const navigate = useNavigate()
  const [tickets, setTickets]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [stateFilter, setStateFilter] = useState('')
  const [expanded, setExpanded]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (stateFilter) params.state = stateFilter
      const { data } = await getZammadTickets(params)
      setTickets(Array.isArray(data) ? data : [])
    } catch {
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [stateFilter])

  useEffect(() => { load() }, [load])

  const toggleExpand = (id) => setExpanded((prev) => (prev === id ? null : id))

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Support Tickets</div>
          <div className="page-subheading">
            {loading ? 'Loading…' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STATE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`filter-pill${stateFilter === key ? ' active' : ''}`}
            onClick={() => setStateFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading tickets…</span></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">No Tickets Found</div>
          <div className="empty-sub">
            {stateFilter ? 'No tickets match the selected filter.' : 'Tickets assigned to the development team will appear here.'}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>State</th>
                <th>Priority</th>
                <th>Customer</th>
                <th>Owner</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleExpand(t.id)}
                  >
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      #{t.number}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', transition: 'transform .15s', display: 'inline-block', transform: expanded === t.id ? 'rotate(90deg)' : 'none' }}>
                          ▶
                        </span>
                        {t.title}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${(t.state || '').toLowerCase().replace(/ /g, '_')}`}>
                        <span className="status-dot" />
                        {t.state}
                      </span>
                    </td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t.customer_name || '—'}</div>
                      {t.customer_email && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.customer_email}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {t.owner_email || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(t.created_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '3px 10px', height: 'auto', whiteSpace: 'nowrap' }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/tasks/new?ticketId=${t.ticket_id}`) }}
                      >
                        + New Task
                      </button>
                    </td>
                  </tr>

                  {expanded === t.id && (
                    <tr>
                      <td />
                      <td colSpan={7}>
                        {(t.article_from || t.article_body) && (
                          <div style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            marginBottom: 8,
                          }}>
                            {t.article_from && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>From:</span>{' '}
                                {t.article_from}
                              </div>
                            )}
                            {t.article_body && (
                              <div style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.6,
                              }}>
                                {t.article_body}
                              </div>
                            )}
                          </div>
                        )}
                        <LinkedTasks ticketId={t.ticket_id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
