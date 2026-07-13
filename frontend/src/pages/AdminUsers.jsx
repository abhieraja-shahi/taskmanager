import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, updateUserRole, deleteUser } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // user id being updated
  const [deleting, setDeleting] = useState(null) // user id being deleted

  useEffect(() => {
    getUsers()
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  const handleRoleChange = async (userId, role) => {
    setUpdating(userId)
    try {
      const { data } = await updateUserRole(userId, role)
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Deactivate user "${u.username}"? They will no longer be able to log in.`)) return
    setDeleting(u.id)
    try {
      await deleteUser(u.id)
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: false } : x))
      toast.success('User deactivated.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to deactivate user')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading users…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/users/new')}>
          + Create Account
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Username', 'Email', 'Role', 'Status', 'Joined', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{u.username}</span>
                    {u.id === me?.id && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-raised)', padding: '1px 6px', borderRadius: 4 }}>you</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  {u.role === 'admin' ? (
                    <span className={`role-badge role-admin`}>admin</span>
                  ) : (
                    <select
                      className="form-control"
                      style={{ padding: '3px 8px', fontSize: 12, width: 'auto' }}
                      value={u.role}
                      disabled={updating === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, color: u.is_active ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {u.id !== me?.id && u.role !== 'admin' && u.is_active && (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={deleting === u.id}
                      onClick={() => handleDeleteUser(u)}
                    >
                      {deleting === u.id ? '…' : 'Deactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
