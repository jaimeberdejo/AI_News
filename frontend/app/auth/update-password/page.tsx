'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/auth/actions'

export default function UpdatePasswordPage() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      await updatePassword(formData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPending(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: '#000',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        <h1
          style={{
            color: '#ffffff',
            fontSize: '1.2rem',
            fontWeight: 600,
            margin: '0 0 8px 0',
          }}
        >
          Set a new password
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.875rem',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
          }}
        >
          Enter and confirm your new password below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="password"
              style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="New password"
              minLength={8}
              required
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                color: '#ffffff',
                padding: '12px 16px',
                fontSize: '0.95rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              htmlFor="confirm"
              style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}
            >
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              name="confirm"
              placeholder="Confirm new password"
              required
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                color: '#ffffff',
                padding: '12px 16px',
                fontSize: '0.95rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: '#ff6b6b',
                fontSize: '0.875rem',
                margin: '4px 0 0 0',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              background: '#ffffff',
              color: '#000000',
              borderRadius: 8,
              padding: 12,
              fontWeight: 600,
              fontSize: '0.95rem',
              width: '100%',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
              border: 'none',
              marginTop: 8,
            }}
          >
            {pending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
