import React, { useEffect, useState, useCallback } from 'react'
import {
  getDeployments,
  createDeployment,
  uploadDeploymentScript,
  deleteDeployment,
  getBanks,
  getTasks,
  searchUsers,
} from '../api/client'
import Modal from '../components/Modal'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

const ARTIFACT_TYPES = ['WAR', 'EAR']
const SOFTWARE_VERSIONS = ['eBank', 'BnkBiz', 'Other']

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function TypeBadge({ type }) {
  const color = type === 'WAR' ? 'var(--color-cyan)' : 'var(--color-amber)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      color, border: `1px solid ${color}`, borderRadius: 4,
      padding: '1px 6px',
    }}>
      {type}
    </span>
  )
}

function VersionBadge({ version }) {
  const colorMap = {
    eBank: 'var(--color-cyan)',
    BnkBiz: 'var(--color-amber)',
    Other: 'var(--text-muted)',
  }
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: colorMap[version] || 'var(--text-secondary)' }}>
      {version}
    </span>
  )
}


function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

const EMPTY_FORM = {
  name: '',
  artifact_type: 'WAR',
  software_version: 'eBank',
  purpose: '',
  deployed_by_id: null,
  deployed_at: '',
  bank_ids: [],
  task_ids: [],
}

export default function Deployments() {
  const toast = useToast()
  const { user } = useAuth()

  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)
  const [banks, setBanks] = useState([])
  const [tasks, setTasks] = useState([])
  const [expanded, setExpanded] = useState(null)

  // Filters
  const [filterVersion, setFilterVersion] = useState('')
  const [filterBankId, setFilterBankId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [scriptFile, setScriptFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [deployedBySearch, setDeployedBySearch] = useState('')
  const [deployedByResults, setDeployedByResults] = useState([])
  const [deployedByUser, setDeployedByUser] = useState(null)
  const [deployedByDropdown, setDeployedByDropdown] = useState(false)

  useEffect(() => {
    getBanks().then(({ data }) => setBanks(data || [])).catch(() => {})
    getTasks().then(({ data }) => setTasks(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterVersion) params.software_version = filterVersion
      if (filterBankId) params.bank_id = filterBankId
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo
      const { data } = await getDeployments(params)
      setDeployments(Array.isArray(data) ? data : [])
    } catch {
      setDeployments([])
    } finally {
      setLoading(false)
    }
  }, [filterVersion, filterBankId, filterDateFrom, filterDateTo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!deployedBySearch.trim()) { setDeployedByResults([]); return }
    const t = setTimeout(() => {
      searchUsers(deployedBySearch).then(({ data }) => setDeployedByResults(data || [])).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [deployedBySearch])

  const openModal = () => {
    setForm({ ...EMPTY_FORM, deployed_at: nowLocal() })
    setScriptFile(null)
    setBankSearch('')
    setTaskSearch('')
    setDeployedBySearch('')
    setDeployedByResults([])
    setDeployedByUser(null)
    setDeployedByDropdown(false)
    setShowModal(true)
  }

  const toggleBank = (id) => setForm((f) => ({
    ...f,
    bank_ids: f.bank_ids.includes(id) ? f.bank_ids.filter((x) => x !== id) : [...f.bank_ids, id],
  }))

  const toggleTask = (id) => setForm((f) => ({
    ...f,
    task_ids: f.task_ids.includes(id) ? f.task_ids.filter((x) => x !== id) : [...f.task_ids, id],
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.purpose.trim()) {
      toast.error('Name and Purpose are required.')
      return
    }
    if (!deployedByUser) {
      toast.error('Deployed By is required.')
      return
    }
    if (!form.deployed_at) {
      toast.error('Deployed At is required.')
      return
    }
    setSaving(true)
    try {
      const { data } = await createDeployment({
        artifact_type: form.artifact_type,
        software_version: form.software_version,
        name: form.name.trim(),
        purpose: form.purpose.trim(),
        deployed_by_id: deployedByUser ? deployedByUser.id : null,
        deployed_at: form.deployed_at ? new Date(form.deployed_at).toISOString() : null,
        bank_ids: form.bank_ids,
        task_ids: form.task_ids,
      })
      if (scriptFile) {
        await uploadDeploymentScript(data.id, scriptFile)
      }
      toast.success('Deployment logged.')
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save deployment.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete deployment "${d.name}"?`)) return
    try {
      await deleteDeployment(d.id)
      toast.success('Deployment deleted.')
      setDeployments((prev) => prev.filter((x) => x.id !== d.id))
    } catch {
      toast.error('Failed to delete deployment.')
    }
  }

  const clearFilters = () => {
    setFilterVersion('')
    setFilterBankId('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const hasFilters = filterVersion || filterBankId || filterDateFrom || filterDateTo

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-heading">WAR / EAR Deployments</div>
          <div className="page-subheading">
            {loading ? 'Loading…' : `${deployments.length} deployment${deployments.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          + Log Deployment
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Version</div>
          <select
            className="form-control"
            style={{ fontSize: 12, padding: '5px 8px', minWidth: 110 }}
            value={filterVersion}
            onChange={(e) => setFilterVersion(e.target.value)}
          >
            <option value="">All</option>
            {SOFTWARE_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bank</div>
          <select
            className="form-control"
            style={{ fontSize: 12, padding: '5px 8px', minWidth: 140 }}
            value={filterBankId}
            onChange={(e) => setFilterBankId(e.target.value)}
          >
            <option value="">All Banks</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>From</div>
          <input
            type="date"
            className="form-control"
            style={{ fontSize: 12, padding: '5px 8px' }}
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>To</div>
          <input
            type="date"
            className="form-control"
            style={{ fontSize: 12, padding: '5px 8px' }}
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        {hasFilters && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px', alignSelf: 'flex-end' }}
            onClick={clearFilters}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Loading deployments…</span></div>
      ) : deployments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◯</div>
          <div className="empty-title">No Deployments Found</div>
          <div className="empty-sub">
            {hasFilters ? 'No deployments match the current filters.' : 'Log your first WAR/EAR deployment to get started.'}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Type</th>
                <th>Software</th>
                <th>Banks</th>
                <th>Purpose</th>
                <th>Deployed By</th>
                <th>Date</th>
                <th>Script</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <React.Fragment key={d.id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpanded((prev) => (prev === d.id ? null : d.id))}
                  >
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{d.id}</td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--text-bright)' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'inline-block', transition: 'transform .15s', transform: expanded === d.id ? 'rotate(90deg)' : 'none' }}>
                          ▶
                        </span>
                        {d.name}
                      </div>
                    </td>

                    <td><TypeBadge type={d.artifact_type} /></td>
                    <td><VersionBadge version={d.software_version} /></td>

                    <td>
                      {d.banks.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {d.banks.map((b) => (
                            <span key={b.id} style={{
                              fontSize: 10, padding: '1px 6px',
                              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                              borderRadius: 4, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                            }}>
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.purpose}
                      </div>
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {d.deployed_by?.username || '—'}
                    </td>

                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(d.deployed_at || d.created_at)}
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      {d.script_filename ? (
                        <a
                          href={`/deployments/${d.id}/script/download`}
                          title={`${d.script_filename} (${formatBytes(d.script_file_size)})`}
                          style={{ color: 'var(--color-cyan)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 12h12" strokeLinecap="round"/>
                          </svg>
                          {d.script_filename.length > 16 ? d.script_filename.slice(0, 14) + '…' : d.script_filename}
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
                        onClick={() => handleDelete(d)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>

                  {expanded === d.id && (
                    <tr>
                      <td />
                      <td colSpan={9}>
                        <div style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px',
                          marginBottom: 6,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                        }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                              Purpose
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {d.purpose}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                              Linked Tasks
                            </div>
                            {d.tasks.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No linked tasks.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {d.tasks.map((t) => (
                                  <div key={t.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>#{t.id}</span>{' '}
                                    {t.title}
                                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                                      [{t.status.replace(/_/g, ' ')}]
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Deployment Modal */}
      {showModal && (
        <Modal title="Log Deployment" onClose={() => setShowModal(false)} wide>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Row 1: Name (full width) */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Name *</label>
                <input
                  className="form-control"
                  placeholder="e.g. banking-core.war"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              {/* Row 2: Type | Software */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Type *</label>
                <select
                  className="form-control"
                  value={form.artifact_type}
                  onChange={(e) => setForm((f) => ({ ...f, artifact_type: e.target.value }))}
                >
                  {ARTIFACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Software *</label>
                <select
                  className="form-control"
                  value={form.software_version}
                  onChange={(e) => setForm((f) => ({ ...f, software_version: e.target.value }))}
                >
                  {SOFTWARE_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Row 3: Deployed By | Deployed At */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Deployed By *</label>
                {deployedByUser ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-elevated)', border: '1px solid var(--color-cyan)',
                    borderRadius: 'var(--radius-md)', padding: '7px 10px',
                  }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{deployedByUser.username}</span>
                    <span
                      onClick={() => { setDeployedByUser(null); setDeployedBySearch('') }}
                      style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1 }}
                    >×</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-control"
                      placeholder="Search users…"
                      value={deployedBySearch}
                      onChange={(e) => { setDeployedBySearch(e.target.value); setDeployedByDropdown(true) }}
                      onFocus={() => setDeployedByDropdown(true)}
                      onBlur={() => setTimeout(() => setDeployedByDropdown(false), 150)}
                    />
                    {deployedByDropdown && deployedByResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: 'var(--bg-base)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', marginTop: 4,
                        maxHeight: 180, overflowY: 'auto',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}>
                        {deployedByResults.map((u) => (
                          <div
                            key={u.id}
                            onMouseDown={() => { setDeployedByUser(u); setDeployedBySearch(''); setDeployedByDropdown(false) }}
                            style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                            {u.role !== 'user' && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{u.role}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Deployed At *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={form.deployed_at}
                  onChange={(e) => setForm((f) => ({ ...f, deployed_at: e.target.value }))}
                  required
                />
              </div>

              {/* Row 4: Purpose (full width) */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Purpose *</label>
                <textarea
                  className="form-control"
                  placeholder="Describe what this deployment does / what changed…"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  required
                />
              </div>

              {/* Row 5: Banks | Linked Tasks */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Banks</label>
                {form.bank_ids.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {form.bank_ids.map((bid) => {
                      const bank = banks.find((b) => b.id === bid)
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
                            onClick={() => toggleBank(bid)}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, marginLeft: 2 }}
                          >×</span>
                        </span>
                      )
                    })}
                  </div>
                )}
                <input
                  className="form-control"
                  placeholder="Search banks…"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                />
                {bankSearch && (
                  <div className="multi-select-wrap" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                    {banks
                      .filter((b) => !form.bank_ids.includes(b.id) && b.name.toLowerCase().includes(bankSearch.toLowerCase()))
                      .map((bank) => (
                        <div
                          key={bank.id}
                          className="multi-select-item"
                          onClick={() => { toggleBank(bank.id); setBankSearch('') }}
                        >
                          <div>{bank.name}</div>
                        </div>
                      ))}
                    {banks.filter((b) => !form.bank_ids.includes(b.id) && b.name.toLowerCase().includes(bankSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>No banks match your search.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Linked Tasks</label>
                {form.task_ids.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {form.task_ids.map((tid) => {
                      const task = tasks.find((t) => t.id === tid)
                      if (!task) return null
                      return (
                        <span key={tid} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, padding: '4px 8px',
                          background: 'var(--bg-elevated)', border: '1px solid var(--color-cyan)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                        }}>
                          #{task.id} — {task.title}
                          <span
                            onClick={() => toggleTask(tid)}
                            style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, marginLeft: 2 }}
                          >×</span>
                        </span>
                      )
                    })}
                  </div>
                )}
                <input
                  className="form-control"
                  placeholder="Search tasks…"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                />
                {taskSearch && (
                  <div className="multi-select-wrap" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                    {tasks
                      .filter((t) => !form.task_ids.includes(t.id) && (`#${t.id} ${t.title}`).toLowerCase().includes(taskSearch.toLowerCase()))
                      .map((task) => (
                        <div
                          key={task.id}
                          className="multi-select-item"
                          onClick={() => { toggleTask(task.id); setTaskSearch('') }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10, marginRight: 4 }}>#{task.id}</span>
                            {task.title}
                          </div>
                        </div>
                      ))}
                    {tasks.filter((t) => !form.task_ids.includes(t.id) && (`#${t.id} ${t.title}`).toLowerCase().includes(taskSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>No tasks match your search.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 6: Script File (full width) */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Script File <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="file"
                  className="form-control"
                  style={{ fontSize: 12 }}
                  onChange={(e) => setScriptFile(e.target.files[0] || null)}
                />
                {scriptFile && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {scriptFile.name} — {formatBytes(scriptFile.size)}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Log Deployment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
