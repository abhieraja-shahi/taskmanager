import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActivityLogs, getTeams, searchUsers } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const ACTION_LABELS = {
  TASK_CREATED:    'Task Created',
  TASK_ACCEPTED:   'Task Accepted',
  TASK_REJECTED:   'Task Declined',
  READY_FOR_REVIEW:'Marked Ready for Review',
  TASK_COMPLETED:  'Marked Complete',
  REVIEW_REJECTED: 'Changes Requested',
  COMMENT_ADDED:   'Comment Added',
  USER_COMPLETED:  'Marked Ready for Review',  // legacy label
  MANAGER_APPROVED:'Marked Complete',           // legacy label
  MANAGER_REJECTED:'Changes Requested',         // legacy label
}

const ACTION_COLORS = {
  TASK_CREATED:     'var(--color-cyan)',
  TASK_ACCEPTED:    'var(--color-green)',
  TASK_REJECTED:    'var(--color-red)',
  READY_FOR_REVIEW: 'var(--color-amber)',
  TASK_COMPLETED:   'var(--color-green)',
  REVIEW_REJECTED:  'var(--color-orange, var(--color-amber))',
  COMMENT_ADDED:    'var(--text-secondary)',
  USER_COMPLETED:   'var(--color-amber)',
  MANAGER_APPROVED: 'var(--color-green)',
  MANAGER_REJECTED: 'var(--color-orange, var(--color-amber))',
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAGE_SIZE = 50

export default function ActivityLog() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(false)
  const [skip, setSkip]             = useState(0)
  const [teams, setTeams]           = useState([])

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')
  const [teamId, setTeamId]     = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSuggestions, setUserSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = React.useRef(null)

  const buildParams = useCallback(() => {
    const params = { limit: PAGE_SIZE }
    if (fromDate)         params.from_date = fromDate
    if (toDate)           params.to_date   = toDate
    if (teamId)           params.team_id   = teamId
    if (selectedUser?.id) params.user_id   = selectedUser.id
    return params
  }, [fromDate, toDate, teamId, selectedUser])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setSkip(0)
    try {
      const { data } = await getActivityLogs({ ...buildParams(), skip: 0 })
      const results = data || []
      setLogs(results)
      setHasMore(results.length === PAGE_SIZE)
    } catch { setLogs([]); setHasMore(false) }
    finally { setLoading(false) }
  }, [buildParams])

  const loadMore = useCallback(async () => {
    const nextSkip = skip + PAGE_SIZE
    setLoadingMore(true)
    try {
      const { data } = await getActivityLogs({ ...buildParams(), skip: nextSkip })
      const results = data || []
      setLogs(prev => [...prev, ...results])
      setSkip(nextSkip)
      setHasMore(results.length === PAGE_SIZE)
    } catch {}
    finally { setLoadingMore(false) }
  }, [skip, buildParams])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { getTeams().then(({ data }) => setTeams(data || [])).catch(() => {}) }, [])

  // Username autocomplete
  useEffect(() => {
    if (!userSearch.trim()) { setUserSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await searchUsers(userSearch)
        setUserSuggestions(data || [])
        setShowSuggestions(true)
      } catch { setUserSuggestions([]) }
    }, 250)
  }, [userSearch])

  const clearFilters = () => {
    setFromDate(''); setToDate(''); setTeamId(''); setUserSearch(''); setSelectedUser(null)
  }

  const hasFilters = fromDate || toDate || teamId || selectedUser

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Activity Log</div>
          <div className="page-subheading">
            {loading ? 'Loading…' : `${logs.length} event${logs.length !== 1 ? 's' : ''}${hasMore ? '+' : ''}`}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Team</label>
            <select
              className="form-control"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <label className="form-label">
              User
              {selectedUser && (
                <span
                  style={{ marginLeft: 6, cursor: 'pointer', color: 'var(--color-red)', fontSize: 10 }}
                  onClick={() => { setSelectedUser(null); setUserSearch('') }}
                >✕ clear</span>
              )}
            </label>
            {selectedUser ? (
              <div className="form-control" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                <div className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>
                  {selectedUser.username.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ fontSize: 12 }}>{selectedUser.username}</span>
              </div>
            ) : (
              <>
                <input
                  className="form-control"
                  placeholder="Search username…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onFocus={() => userSuggestions.length && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
                {showSuggestions && userSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,.3)',
                  }}>
                    {userSuggestions.map((u) => (
                      <div
                        key={u.id}
                        style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                        onMouseDown={() => { setSelectedUser(u); setUserSearch(u.username); setShowSuggestions(false) }}
                      >
                        <span style={{ color: 'var(--text-bright)' }}>{u.username}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 10 }}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {hasFilters && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear Filters</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading activity…</span></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">○</div>
          <div className="empty-title">No Activity Found</div>
          <div className="empty-sub">{hasFilters ? 'Try adjusting your filters.' : 'Activity will appear here as tasks are worked on.'}</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Task</th>
                <th>User</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(log.timestamp)}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: ACTION_COLORS[log.action] || 'var(--text-primary)',
                    }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td>
                    {log.task ? (
                      <span
                        style={{ fontSize: 12, color: 'var(--color-cyan)', cursor: 'pointer' }}
                        onClick={() => navigate(`/tasks/${log.task_id}`)}
                      >
                        #{log.task_id} {log.task.title}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{log.task_id}</span>
                    )}
                  </td>
                  <td>
                    {log.user ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 9, flexShrink: 0 }}>
                          {log.user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-bright)', fontWeight: 500 }}>
                            {log.user.username}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {log.user.role}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {log.user_id ? `#${log.user_id}` : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.detail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      )}
    </>
  )
}
