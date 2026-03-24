'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/app/auth/actions'

interface AuthBottomSheetProps {
  isOpen: boolean
  actionLabel: string  // e.g. "like this" | "bookmark this" | "comment"
  returnPath: string   // e.g. "/?videoIndex=3" — passed to signInWithGoogle
  onClose: () => void
}

export function AuthBottomSheet({
  isOpen,
  actionLabel,
  returnPath,
  onClose,
}: AuthBottomSheetProps) {
  const [signing, setSigning] = useState(false)

  async function handleSignIn() {
    if (signing) return
    setSigning(true)
    try {
      const { url } = await signInWithGoogle(returnPath)
      // MUST use window.location.href — window.open() is broken in iOS PWA standalone mode
      window.location.href = url
    } catch {
      setSigning(false)
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

        {/* Google sign-in button — official white/border branding */}
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
            width: 'calc(100% - 64px)',
            cursor: signing ? 'not-allowed' : 'pointer',
            opacity: signing ? 0.8 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {/* Google G logo SVG — official colored quadrant mark */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          {signing ? 'Signing in\u2026' : 'Continue with Google'}
        </button>
      </div>
    </>
  )
}
