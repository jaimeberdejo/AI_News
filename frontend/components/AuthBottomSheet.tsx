'use client'

import { useState } from 'react'
import { signIn } from '@/app/auth/actions'

interface AuthBottomSheetProps {
  isOpen: boolean
  actionLabel: string  // e.g. "like this" | "bookmark this" | "comment"
  returnPath: string
  onClose: () => void
}

export function AuthBottomSheet({
  isOpen,
  actionLabel,
  onClose,
}: AuthBottomSheetProps) {
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

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '430px',
          margin: '0 auto',
          height: '50vh',
          background: '#1a1a1a',
          borderRadius: '20px 20px 0 0',
          zIndex: 101,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        {/* Drag handle pill */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
          }}
        />

        {/* Contextual headline */}
        <p
          style={{
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            padding: '0 32px',
            margin: 0,
          }}
        >
          Sign in to {actionLabel}
        </p>

        {/* Email/password sign-in form */}
        <form
          onSubmit={handleSignIn}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: 'calc(100% - 64px)' }}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Email address"
            style={{
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
            }}
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Password"
            style={{
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
            }}
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

        <a
          href="/auth/login"
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.8rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textDecoration: 'underline',
            cursor: 'pointer',
            marginTop: '-8px',
          }}
        >
          Create account
        </a>
      </div>
    </>
  )
}
