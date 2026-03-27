'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/app/auth/actions'

export default function LoginPage() {
  const [signing, setSigning] = useState(false)

  async function handleSignIn() {
    if (signing) return
    setSigning(true)
    try {
      const { url } = await signInWithGoogle('/profile')
      // MUST use window.location.href — window.open() is broken in iOS PWA standalone mode
      window.location.href = url
    } catch {
      setSigning(false)
    }
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
        gap: '32px',
        padding: '0 32px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            color: 'white',
            fontSize: '1.4rem',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: '0 0 8px',
          }}
        >
          Sign in to AInews
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

      <button
        onClick={handleSignIn}
        disabled={signing}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: signing ? '#f8f8f8' : '#ffffff',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          padding: '12px 24px',
          color: '#3c4043',
          fontSize: '0.95rem',
          fontWeight: 500,
          fontFamily: "'Roboto', system-ui, sans-serif",
          width: '100%',
          maxWidth: '320px',
          cursor: signing ? 'not-allowed' : 'pointer',
          opacity: signing ? 0.8 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
        {signing ? 'Signing in…' : 'Continue with Google'}
      </button>
    </div>
  )
}
