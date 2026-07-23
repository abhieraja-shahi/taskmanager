import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getZammadTickets, getTicketTasks, getTicketArticles, resolveZammadTicket, postTicketNote } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

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
    timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function PriorityBadge({ priority }) {
  if (!priority) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const color = PRIORITY_COLORS[priority.toLowerCase()] || 'var(--text-secondary)'
  const label = priority.replace(/^\d\s/, '')
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
}

const SENDER_COLORS = {
  Customer: 'var(--color-cyan)',
  Agent:    'var(--color-amber)',
  System:   'var(--text-muted)',
}

function ArticleHistory({ ticketId, isResolved }) {
  const [articles, setArticles] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const loadArticles = useCallback(() => {
    setLoading(true)
    getTicketArticles(ticketId)
      .then(({ data }) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load conversation history.'))
      .finally(() => setLoading(false))
  }, [ticketId])

  useEffect(() => { loadArticles() }, [loadArticles])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Loading conversation…</div>
  if (error)   return <div style={{ fontSize: 12, color: 'var(--color-red)', marginBottom: 8 }}>{error}</div>

  return (
    <>
      {articles && articles.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Conversation ({articles.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {articles.map((a) => {
              const senderColor = SENDER_COLORS[a.sender] || 'var(--text-secondary)'
              return (
                <div
                  key={a.id}
                  style={{
                    background: a.internal ? 'color-mix(in srgb, var(--color-amber) 8%, var(--bg-elevated))' : 'var(--bg-elevated)',
                    border: `1px solid ${a.internal ? 'color-mix(in srgb, var(--color-amber) 30%, var(--border))' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: senderColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {a.sender || 'Unknown'}
                    </span>
                    {a.internal && (
                      <span style={{ fontSize: 10, color: 'var(--color-amber)', border: '1px solid var(--color-amber)', borderRadius: 4, padding: '0 4px', lineHeight: '16px' }}>
                        internal
                      </span>
                    )}
                    {a.from_address && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.from_address}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                      {formatDate(a.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {a.body || <em style={{ color: 'var(--text-muted)' }}>No content</em>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {!isResolved && (
        <ReplyComposer ticketId={ticketId} onNoteSent={loadArticles} />
      )}
    </>
  )
}

function ReplyComposer({ ticketId, onNoteSent }) {
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState(null)

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      await postTicketNote(ticketId, body.trim())
      setBody('')
      onNoteSent()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to post note.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        Post Internal Note
      </div>
      <div style={{
        background: 'color-mix(in srgb, var(--color-amber) 5%, var(--bg-elevated))',
        border: '1px solid color-mix(in srgb, var(--color-amber) 25%, var(--border))',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
      }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write an internal note visible only to agents…"
          rows={3}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          {error
            ? <span style={{ fontSize: 11, color: 'var(--color-red)' }}>{error}</span>
            : <span style={{ fontSize: 10, color: 'var(--color-amber)' }}>internal · visible to agents only</span>
          }
          <button
            className="btn btn-primary"
            style={{ fontSize: 11, padding: '3px 12px', height: 'auto' }}
            disabled={sending || !body.trim()}
            onClick={handleSend}
          >
            {sending ? 'Sending…' : 'Post Note'}
          </button>
        </div>
      </div>
    </div>
  )
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

const RESOLVED_STATES = new Set(['resolved', 'closed'])
const PAGE_SIZE = 20

export default function ZammadTickets() {
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const [tickets, setTickets]         = useState([])
  const [total, setTotal]             = useState(0)
  const [pages, setPages]             = useState(1)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(true)
  const [stateFilter, setStateFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [expanded, setExpanded]       = useState(null)
  const [resolving, setResolving]     = useState(null)
  const debounceRef                   = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (stateFilter) params.state = stateFilter
      if (search) params.search = search
      const { data } = await getZammadTickets(params)
      setTickets(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
    } catch {
      setTickets([])
      setTotal(0)
      setPages(1)
    } finally {
      setLoading(false)
    }
  }, [stateFilter, search, page])

  useEffect(() => { load() }, [load])

  const handleFilterChange = (key) => {
    setStateFilter(key)
    setPage(1)
    setExpanded(null)
  }

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(val.trim())
      setPage(1)
      setExpanded(null)
    }, 300)
  }

  const handleSearchClear = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
    setExpanded(null)
  }

  const toggleExpand = (id) => setExpanded((prev) => (prev === id ? null : id))

  const handleResolve = async (e, ticketId) => {
    e.stopPropagation()
    if (!window.confirm('Mark this ticket as closed in Zammad?')) return
    setResolving(ticketId)
    try {
      await resolveZammadTicket(ticketId)
      setTickets((prev) =>
        prev.map((t) => t.ticket_id === ticketId ? { ...t, state: 'Closed' } : t)
      )
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to resolve ticket.')
    } finally {
      setResolving(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Support Tickets</div>
          <div className="page-subheading">
            {loading ? 'Loading…' : `${total} ticket${total !== 1 ? 's' : ''}${pages > 1 ? ` · page ${page} of ${pages}` : ''}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATE_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`filter-pill${stateFilter === key ? ' active' : ''}`}
            onClick={() => handleFilterChange(key)}
          >
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search tickets…"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              padding: '5px 28px 5px 10px',
              outline: 'none',
              width: 220,
            }}
          />
          {searchInput && (
            <button
              onClick={handleSearchClear}
              style={{
                position: 'absolute', right: 6, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading tickets…</span></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">No Tickets Found</div>
          <div className="empty-sub">
            {search || stateFilter ? 'No tickets match your search or filter.' : 'Tickets assigned to the development team will appear here.'}
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 10px', height: 'auto', whiteSpace: 'nowrap' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/tasks/new?ticketId=${t.ticket_id}`) }}
                        >
                          + New Task
                        </button>
                        {isManager && !RESOLVED_STATES.has((t.state || '').toLowerCase()) && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '3px 10px', height: 'auto', whiteSpace: 'nowrap' }}
                            disabled={resolving === t.ticket_id}
                            onClick={(e) => handleResolve(e, t.ticket_id)}
                          >
                            {resolving === t.ticket_id ? '…' : 'Close'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded === t.id && (
                    <tr>
                      <td />
                      <td colSpan={7}>
                        <ArticleHistory ticketId={t.ticket_id} isResolved={RESOLVED_STATES.has((t.state || '').toLowerCase())} />
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

      {pages > 1 && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px', height: 'auto' }}
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px', height: 'auto' }}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Prev
          </button>

          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((item, idx) =>
              item === '…' ? (
                <span key={`ellipsis-${idx}`} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
              ) : (
                <button
                  key={item}
                  className={`btn${item === page ? ' btn-primary' : ' btn-secondary'}`}
                  style={{ fontSize: 12, padding: '4px 10px', height: 'auto', minWidth: 32 }}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )
          }

          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px', height: 'auto' }}
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 12px', height: 'auto' }}
            disabled={page === pages}
            onClick={() => setPage(pages)}
          >
            »
          </button>
        </div>
      )}
    </>
  )
}
