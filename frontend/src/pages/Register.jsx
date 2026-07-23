import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { register as registerApi } from '../api/client'
import logoBlue from '../../public/ethereal-logo-blue.png'

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const { data } = await registerApi(form)
      setSuccess(`Account created for ${data.username}.`)
      setForm({ email: '', username: '', password: '' })
    } catch (err) {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Registration failed. Email or username may already be taken.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logoBlue} alt="Ethereal Informatics" className="auth-logo-img" />
          <div className="auth-logo-sub">Task Manager</div>
        </div>

        <div className="auth-title">Create Account</div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>⚠</span> {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            <span>✓</span> {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="your_handle"
              value={form.username}
              onChange={set('username')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
              : 'Create Account'}
          </button>
        </form>

        <div className="auth-link">
          <Link to="/">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
