import React, { useEffect, useState } from 'react'
import { getBanks, createBank, updateBank, deleteBank } from '../api/client'
import { useToast } from '../contexts/ToastContext'

export default function AdminBanks() {
  const toast = useToast()
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    getBanks()
      .then(({ data }) => setBanks(data || []))
      .catch(() => toast.error('Failed to load banks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createBank({ name: newName.trim() })
      setNewName('')
      toast.success('Bank added.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add bank')
    } finally {
      setAdding(false)
    }
  }

  const handleUpdate = async (id) => {
    if (!editName.trim()) return
    try {
      await updateBank(id, { name: editName.trim() })
      setEditId(null)
      toast.success('Bank updated.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update bank')
    }
  }

  const handleDelete = async (bank) => {
    if (!window.confirm(`Remove "${bank.name}" from the system?`)) return
    try {
      await deleteBank(bank.id)
      toast.success('Bank removed.')
      setBanks((prev) => prev.filter((b) => b.id !== bank.id))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove bank')
    }
  }

  const filtered = banks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading banks...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Banks</h1>
          <p className="page-subtitle">{banks.length} bank{banks.length !== 1 ? 's' : ''} in the system</p>
        </div>
      </div>

      {/* Add bank form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Add New Bank</label>
            <input
              className="form-control"
              placeholder="Enter bank name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
            {adding ? 'Adding...' : 'Add Bank'}
          </button>
        </form>
      </div>

      {/* Search */}
      {banks.length > 10 && (
        <div style={{ marginBottom: 12 }}>
          <input
            className="form-control"
            placeholder="Search banks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
      )}

      {/* Bank list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {banks.length === 0 ? 'No banks added yet.' : 'No banks match your search.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Bank Name
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, width: 160 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bank) => (
                <tr key={bank.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    {editId === bank.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="form-control"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(bank.id); if (e.key === 'Escape') setEditId(null) }}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(bank.id)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    ) : (
                      bank.name
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    {editId !== bank.id && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditId(bank.id); setEditName(bank.name) }}
                        >
                          Rename
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(bank)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
