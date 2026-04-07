'use client'

import { useState } from 'react'
import { signIn, signUp } from '@/app/auth/actions'

type Tab = 'signin' | 'register'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('register')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signIn(new FormData(e.currentTarget))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPending(false)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    try {
      await signUp(formData)
      // signUp now calls redirect('/') — if we reach here, something unexpected happened
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPending(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#ffffff',
    padding: '12px 16px',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }

  return (
    <div
      style={{
        height: '100dvh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p
          style={{
            color: 'white',
            fontSize: '1.4rem',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: '0 0 8px',
          }}
        >
          {tab === 'signin' ? 'Sign in to AI News' : 'Create an account'}
        </p>
        <p
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.9rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: 0,
          }}
        >
          Like, save, comment, and manage your profile
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button
          onClick={() => setTab('signin')}
          style={{
            background: tab === 'signin' ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: tab === 'signin' ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
            borderRadius: '20px',
            padding: '6px 20px',
            color: tab === 'signin' ? '#ffffff' : 'rgba(255,255,255,0.45)',
            fontSize: '0.875rem',
            fontWeight: tab === 'signin' ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Sign in
        </button>
        <button
          onClick={() => setTab('register')}
          style={{
            background: tab === 'register' ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: tab === 'register' ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
            borderRadius: '20px',
            padding: '6px 20px',
            color: tab === 'register' ? '#ffffff' : 'rgba(255,255,255,0.45)',
            fontSize: '0.875rem',
            fontWeight: tab === 'register' ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Create account
        </button>
      </div>

      {/* Sign in tab */}
      {tab === 'signin' && (
        <form
          onSubmit={handleSignIn}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Email address"
            style={inputStyle}
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Password"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              background: pending ? 'rgba(255,255,255,0.5)' : '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer',
              width: '100%',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '0.875rem', textAlign: 'center', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {error}
            </p>
          )}
        </form>
      )}

      {/* Register tab */}
      {tab === 'register' && (
        <form
          onSubmit={handleRegister}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Email address"
            style={inputStyle}
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Password (8+ characters)"
            style={inputStyle}
          />
          <input
            type="password"
            name="confirm"
            required
            placeholder="Confirm password"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={pending}
            style={{
              background: pending ? 'rgba(255,255,255,0.5)' : '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer',
              width: '100%',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {pending ? 'Creating account…' : 'Create account'}
          </button>
          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '0.875rem', textAlign: 'center', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
