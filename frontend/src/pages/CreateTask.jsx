import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createTask, getTeams, getUsers, getZammadTickets, getBanks, uploadTaskAttachment } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function CreateTask() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [form, setForm] = useState({
    title: '', description: '', start_date: '', due_date: '',
    assignee_ids: [], team_ids: [], bank_ids: [],
  })
  const [allTeams, setAllTeams]   = useState([])
  const [allUsers, setAllUsers]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Banks
  const [allBanks, setAllBanks]           = useState([])
  const [bankSearch, setBankSearch]       = useState('')

  // File attachments
  const [files, setFiles]               = useState([])

  // Ticket linking
  const [allTickets, setAllTickets]       = useState([])
  const [ticketSearch, setTicketSearch]   = useState('')
  const [linkedTicket, setLinkedTicket]   = useState(null)
  const [ticketDropdown, setTicketDropdown] = useState(false)

  // For managers: which teams they manage
  const myTeams = isAdmin ? allTeams : allTeams.filter((t) => t.managers?.some((m) => m.user_id === user?.id))

  // Individual users derived from managed teams (or all users for admin)
  const availableUsers = isAdmin
    ? allUsers
    : (() => {
        const seen = new Map()
        myTeams.forEach((team) => {
          team.members?.forEach((m) => {
            if (!seen.has(m.user_id)) {
              seen.set(m.user_id, {
                id: m.user_id,
                username: m.user?.username || `User #${m.user_id}`,
                role: m.user?.role || 'user',
                teams: [team.name],
              })
            } else {
              seen.get(m.user_id).teams.push(team.name)
            }
          })
        })
        return [...seen.values()]
      })()

  useEffect(() => {
    getTeams().then(({ data }) => setAllTeams(data || [])).catch(() => {})
    if (isAdmin) {
      getUsers().then(({ data }) => {
        setAllUsers((data || []).map((u) => ({ id: u.id, username: u.username, role: u.role })))
      }).catch(() => {})
    }
    getBanks().then(({ data }) => setAllBanks(data || [])).catch(() => {})
    getZammadTickets().then(({ data }) => {
      const tickets = Array.isArray(data) ? data : []
      setAllTickets(tickets)
      // Pre-link from URL param
      const preId = searchParams.get('ticketId')
      if (preId) {
        const found = tickets.find((t) => String(t.ticket_id) === String(preId))
        if (found) setLinkedTicket(found)
      }
    }).catch(() => {})
  }, [isAdmin, searchParams])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggleId = (key, id) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) return setError('Title is required.')
    if (!form.due_date)     return setError('Due date is required.')
    const dueDate = new Date(form.due_date)
    if (dueDate <= new Date()) return setError('Due date must be after the current date/time.')
    if (form.start_date && dueDate <= new Date(form.start_date))
      return setError('Due date must be after the start date.')

    setLoading(true)
    try {
      const payload = {
        ...form,
        due_date:         new Date(form.due_date).toISOString(),
        start_date:       form.start_date ? new Date(form.start_date).toISOString() : undefined,
        zammad_ticket_id: linkedTicket ? linkedTicket.ticket_id : null,
        bank_ids:         form.bank_ids,
      }
      const { data } = await createTask(payload)
      // Upload any attached files
      for (const file of files) {
        try { await uploadTaskAttachment(data.id, file) }
        catch { toast.error(`Failed to upload ${file.name}`) }
      }
      toast.success('Task created successfully.')
      navigate(`/tasks/${data.id}`)
    } catch (err) {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Failed to create task.')
    } finally {
      setLoading(false)
    }
  }

  const filteredTickets = allTickets.filter((t) => {
    if (!ticketSearch) return true
    const q = ticketSearch.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.number.toLowerCase().includes(q)
    )
  }).slice(0, 10)

  const filteredBanks = allBanks.filter((b) =>
    !bankSearch || b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  const teamsToShow = myTeams
  const hasTeams = teamsToShow.length > 0

  return (
    <>
      <button className="back-link" onClick={() => navigate(-1)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 2L4 6l4 4"/>
        </svg>
        Back
      </button>

      <div className="page-header">
        <div>
          <div className="page-heading">New Task</div>
          <div className="page-subheading">Create and assign a new task</div>
        </div>
      </div>

      <div>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left column — Task details */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Task Title *</label>
                  <input
                    className="form-control"
                    placeholder="What needs to be done?"
                    value={form.title}
                    onChange={set('title')}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Detailed description, acceptance criteria, notes…"
                    value={form.description}
                    onChange={set('description')}
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
                    id="create-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 25 * 1024 * 1024) {
                        toast.error('File too large. Maximum size is 25 MB.')
                      } else {
                        setFiles((prev) => [...prev, file])
                      }
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => document.getElementById('create-file-input').click()}
                    style={{ marginBottom: files.length > 0 ? 8 : 0 }}
                  >
                    Add File
                  </button>
                  {files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {files.map((f, i) => (
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
                            onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Date</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.start_date}
                      onChange={set('start_date')}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Due Date *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.due_date}
                      onChange={set('due_date')}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Banks */}
              {allBanks.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Banks
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(optional)</span>
                    </label>
                    {form.bank_ids.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {form.bank_ids.map((bid) => {
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
                                onClick={() => toggleId('bank_ids', bid)}
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
                      <div className="multi-select-wrap" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                        {filteredBanks.filter((b) => !form.bank_ids.includes(b.id)).map((bank) => (
                          <div
                            key={bank.id}
                            className="multi-select-item"
                            onClick={() => { toggleId('bank_ids', bank.id); setBankSearch('') }}
                          >
                            <div>{bank.name}</div>
                          </div>
                        ))}
                        {filteredBanks.filter((b) => !form.bank_ids.includes(b.id)).length === 0 && (
                          <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>No banks match your search.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ticket Linking */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Link to Support Ticket
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(optional)</span>
                  </label>

                  {linkedTicket ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--bg-elevated)', border: '1px solid var(--color-cyan)',
                      borderRadius: 'var(--radius-md)', padding: '8px 12px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-cyan)' }}>
                          #{linkedTicket.number}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {linkedTicket.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLinkedTicket(null)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
                        title="Remove link"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-control"
                        placeholder="Search tickets by number or title…"
                        value={ticketSearch}
                        onChange={(e) => { setTicketSearch(e.target.value); setTicketDropdown(true) }}
                        onFocus={() => setTicketDropdown(true)}
                        onBlur={() => setTimeout(() => setTicketDropdown(false), 150)}
                      />
                      {ticketDropdown && allTickets.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          background: 'var(--bg-base)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', marginTop: 4,
                          maxHeight: 220, overflowY: 'auto',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        }}>
                          {filteredTickets.length === 0 ? (
                            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No matching tickets</div>
                          ) : filteredTickets.map((t) => (
                            <div
                              key={t.id}
                              onMouseDown={() => { setLinkedTicket(t); setTicketSearch(''); setTicketDropdown(false) }}
                              style={{
                                padding: '8px 12px', cursor: 'pointer',
                                borderBottom: '1px solid var(--border)',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: 'var(--color-cyan)', fontWeight: 600, whiteSpace: 'nowrap' }}>#{t.number}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t.state}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right column — Assignment */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Assign to Teams
                    {!isAdmin && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(your managed teams)</span>}
                  </label>
                  {!hasTeams ? (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '8px 0' }}>
                      {isAdmin
                        ? <>No teams exist. <span style={{ color: 'var(--color-amber)', cursor: 'pointer' }} onClick={() => navigate('/teams')}>Create a team first.</span></>
                        : 'You are not managing any teams yet.'}
                    </div>
                  ) : (
                    <div className="multi-select-wrap">
                      {teamsToShow.map((team) => {
                        const sel = form.team_ids.includes(team.id)
                        return (
                          <div
                            key={team.id}
                            className={`multi-select-item${sel ? ' selected' : ''}`}
                            onClick={() => toggleId('team_ids', team.id)}
                          >
                            <div className="multi-select-check">{sel ? '✓' : ''}</div>
                            <div>
                              <div>{team.name}</div>
                              <div style={{ fontSize: 10, opacity: 0.6 }}>{team.members?.length ?? 0} members</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {availableUsers.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Individual Assignees
                      {isAdmin
                        ? <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(all users & managers)</span>
                        : <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(pick specific members from your teams)</span>}
                    </label>
                    <div className="multi-select-wrap">
                      {availableUsers.map((u) => {
                        const sel = form.assignee_ids.includes(u.id)
                        return (
                          <div
                            key={u.id}
                            className={`multi-select-item${sel ? ' selected' : ''}`}
                            onClick={() => toggleId('assignee_ids', u.id)}
                          >
                            <div className="multi-select-check">{sel ? '✓' : ''}</div>
                            <div>
                              <div>{u.username}</div>
                              <div style={{ fontSize: 10, opacity: 0.6 }}>
                                {isAdmin
                                  ? (u.role !== 'user' ? u.role : '')
                                  : (u.teams?.join(', ') || '')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }}/> Creating…</> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
