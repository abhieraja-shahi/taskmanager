import React, { useEffect, useState, useRef, useCallback } from 'react'
import { getTeams, createTeam, deleteTeam, addTeamMembers, removeTeamMember, searchUsers, addTeamManagers, removeTeamManager } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })
}

function UsernameSearch({ onAdd, excludeIds = [] }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const debounceRef = useRef(null)

  const search = useCallback((q) => {
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await searchUsers(q)
        setSuggestions((data || []).filter((u) => !excludeIds.includes(u.id)))
        setOpen(true)
      } catch { setSuggestions([]) }
      finally { setLoading(false) }
    }, 250)
  }, [excludeIds])

  useEffect(() => { search(query) }, [query, search])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (u) => {
    onAdd(u)
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="form-control"
        placeholder="Type a username to search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
        autoComplete="off"
      />
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {suggestions.map((u) => (
            <div
              key={u.id}
              style={{
                padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}
              onMouseDown={() => pick(u)}
              className="suggestion-item"
            >
              <div className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>
                {u.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-bright)' }}>{u.username}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{u.role}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && !loading && query && suggestions.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', marginTop: 4, padding: '10px 12px',
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          No users found for "{query}"
        </div>
      )}
    </div>
  )
}

function TeamCard({ team, isManager, isAdmin, onManage }) {
  return (
    <div className="team-card">
      <div className="team-card-header">
        <div>
          <div className="team-name">{team.name}</div>
          <div className="team-meta">Created {formatDate(team.created_at)}</div>
          {team.managers?.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--color-cyan)', marginTop: 3 }}>
              Manager{team.managers.length > 1 ? 's' : ''}: {team.managers.map((m) => m.user?.username).filter(Boolean).join(', ')}
            </div>
          )}
        </div>
        {isManager && (
          <button className="btn btn-ghost btn-sm" onClick={() => onManage(team)}>Manage</button>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Members ({team.members?.length ?? 0})
        </div>
        {team.members?.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No members yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {team.members?.slice(0, 6).map((m) => (
              <div key={m.id} className="avatar avatar-lg" title={m.user?.username || `User #${m.user_id}`}>
                {(m.user?.username || `U${m.user_id}`).slice(0, 2).toUpperCase()}
              </div>
            ))}
            {(team.members?.length ?? 0) > 6 && (
              <div className="avatar avatar-lg" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}>
                +{team.members.length - 6}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Teams() {
  const { user, isManager, isAdmin } = useAuth()
  const toast = useToast()
  const [teams, setTeams]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [createModal, setCreate]    = useState(false)
  const [manageModal, setManage]    = useState(null)
  const [teamName, setTeamName]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  // pending members to add (array of {id, username, role})
  const [pendingMembers, setPending] = useState([])

  const load = () => {
    setLoading(true)
    getTeams().then(({ data }) => setTeams(data || [])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!teamName.trim()) return
    setSubmitting(true)
    try {
      await createTeam({ name: teamName.trim(), member_ids: pendingMembers.map((u) => u.id) })
      toast.success('Team created.')
      setCreate(false); setTeamName(''); setPending([])
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create team')
    } finally { setSubmitting(false) }
  }

  const handleAddMembers = async (newUsers) => {
    if (!newUsers.length) return
    setSubmitting(true)
    try {
      await addTeamMembers(manageModal.id, { user_ids: newUsers.map((u) => u.id) })
      toast.success(`${newUsers.length} member(s) added.`)
      const { data } = await getTeams()
      setTeams(data || [])
      const updated = (data || []).find((t) => t.id === manageModal.id)
      if (updated) setManage(updated)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add member')
    } finally { setSubmitting(false) }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await removeTeamMember(manageModal.id, userId)
      toast.success('Member removed.')
      const { data } = await getTeams()
      setTeams(data || [])
      const updated = (data || []).find((t) => t.id === manageModal.id)
      if (updated) setManage(updated)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove member')
    }
  }

  const handleAddManager = async (u) => {
    try {
      await addTeamManagers(manageModal.id, [u.id])
      toast.success(`${u.username} added as manager.`)
      const { data } = await getTeams()
      setTeams(data || [])
      const updated = (data || []).find((t) => t.id === manageModal.id)
      if (updated) setManage(updated)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add manager')
    }
  }

  const handleRemoveManager = async (userId) => {
    try {
      await removeTeamManager(manageModal.id, userId)
      toast.success('Manager removed.')
      const { data } = await getTeams()
      setTeams(data || [])
      const updated = (data || []).find((t) => t.id === manageModal.id)
      if (updated) setManage(updated)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to remove manager')
    }
  }

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"? This cannot be undone.`)) return
    try {
      await deleteTeam(team.id)
      toast.success('Team deleted.')
      setManage(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete team')
    }
  }

  const memberExcludeIds = manageModal?.members?.map((m) => m.user_id) ?? []

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">Teams</div>
          <div className="page-subheading">{teams.length} team{teams.length !== 1 ? 's' : ''}</div>
        </div>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setCreate(true)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 1v8M1 5h8"/>
            </svg>
            New Team
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading teams…</span></div>
      ) : teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◇</div>
          <div className="empty-title">No Teams</div>
          <div className="empty-sub">{isManager ? 'Create a team to get started.' : 'You are not in any teams yet.'}</div>
        </div>
      ) : (
        <div className="team-grid">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} isManager={isManager} isAdmin={isAdmin} onManage={setManage} />
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {createModal && (
        <Modal title="New Team" onClose={() => { setCreate(false); setTeamName(''); setPending([]) }}>
          <div className="form-group">
            <label className="form-label">Team Name *</label>
            <input
              className="form-control"
              placeholder="Engineering, Design, QA…"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Add Members (optional)</label>
            <UsernameSearch
              onAdd={(u) => setPending((p) => p.find((x) => x.id === u.id) ? p : [...p, u])}
              excludeIds={pendingMembers.map((u) => u.id)}
            />
            {pendingMembers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {pendingMembers.map((u) => (
                  <span key={u.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 8px', background: 'var(--bg-overlay)',
                    border: '1px solid var(--border)', borderRadius: 20, fontSize: 11,
                  }}>
                    {u.username}
                    <span
                      style={{ cursor: 'pointer', color: 'var(--color-red)', lineHeight: 1 }}
                      onClick={() => setPending((p) => p.filter((x) => x.id !== u.id))}
                    >×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setCreate(false); setTeamName(''); setPending([]) }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting || !teamName.trim()}>
              {submitting ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </Modal>
      )}

      {/* Manage Team Modal */}
      {manageModal && (
        <Modal title={`Manage — ${manageModal.name}`} wide onClose={() => setManage(null)}>

          {/* Manager assignment (admin only) */}
          {isAdmin && (
            <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Team Managers</div>
              {manageModal.managers?.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>No managers assigned.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {manageModal.managers?.map((m) => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', background: 'var(--bg-overlay)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>
                        {(m.user?.username || `U${m.user_id}`).slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{m.user?.username || `User #${m.user_id}`}</div>
                        {m.user?.role && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.user.role}</div>}
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveManager(m.user_id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>Add manager (must be manager or admin role):</div>
              <UsernameSearch
                onAdd={handleAddManager}
                excludeIds={manageModal.managers?.map((m) => m.user_id) ?? []}
              />
            </div>
          )}

          <div className="section-label" style={{ marginBottom: 12 }}>Current Members</div>
          {manageModal.members?.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>No members yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {manageModal.members?.map((m) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                }}>
                  <div className="avatar">
                    {(m.user?.username || `U${m.user_id}`).slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                      {m.user?.username || `User #${m.user_id}`}
                    </div>
                    {m.user?.role && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.user.role}</div>
                    )}
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveMember(m.user_id)}
                  >Remove</button>
                </div>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginBottom: 8 }}>Add Members</div>
          <UsernameSearch
            onAdd={(u) => handleAddMembers([u])}
            excludeIds={memberExcludeIds}
          />
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>
            Search by username. Only existing users can be added.
          </div>

          {isAdmin && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div className="section-label" style={{ marginBottom: 10, color: 'var(--color-red)' }}>Danger Zone</div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteTeam(manageModal)}
              >
                Delete Team
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
