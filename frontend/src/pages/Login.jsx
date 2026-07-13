import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginApi } from '../api/client'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: tokenData } = await loginApi(form)
      // Store token first so the /auth/me call is authenticated
      localStorage.setItem('token', tokenData.access_token)
      const { data: me } = await api.get('/auth/me')
      login(tokenData.access_token, me)
      navigate('/')
    } catch (err) {
      localStorage.removeItem('token')
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-diamond" />
          <div className="auth-logo-text">ETHEREAL</div>
          <div className="auth-logo-sub">Task Command Interface</div>
        </div>

        <div className="auth-title">Sign In</div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>⚠</span> {error}
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
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Signing in…</>
              : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  )
}
