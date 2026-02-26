'use client'

import { useEffect, useState } from 'react'

interface EndCardProps {
  onReplay: () => void
  currentEditionId: string | null
  onNewEdition: () => void
  isActive: boolean
  isLatestEdition: boolean
}

function getNextEditionMessage(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Check back this morning'
  if (hour < 12) return 'Check back this afternoon'
  if (hour < 18) return 'Check back tonight'
  return 'Check back tomorrow morning'
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#000',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '32px',
  paddingTop: 'calc(env(safe-area-inset-top) + 32px)',
  paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
}

const iconCircleStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '24px',
}

const titleStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '1.5rem',
  fontWeight: '700',
  textAlign: 'center',
  marginBottom: '8px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const subtitleStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.9rem',
  textAlign: 'center',
  marginBottom: '48px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.3)',
  color: 'white',
  borderRadius: '24px',
  padding: '12px 32px',
  fontSize: '0.9rem',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  cursor: 'pointer',
  letterSpacing: '0.03em',
}

export function EndCard({ onReplay, currentEditionId, onNewEdition, isActive, isLatestEdition }: EndCardProps) {
  const [checkMessage] = useState(getNextEditionMessage)

  // Only poll for a newer edition when on the latest edition and the card is visible.
  // Older editions: no polling — a newer edition always exists and would cause an unwanted redirect.
  useEffect(() => {
    if (!isActive || !isLatestEdition) return

    let cancelled = false

    async function checkForNewEdition() {
      try {
        const res = await fetch('/api/today', { cache: 'no-store' })
        const data = await res.json()
        const latestId: string | null = data?.edition?.id ?? null
        if (!cancelled && latestId && latestId !== currentEditionId) {
          onNewEdition()
        }
      } catch {
        // Network error — stay on end card
      }
    }

    checkForNewEdition()
    return () => { cancelled = true }
  }, [isActive, isLatestEdition, currentEditionId, onNewEdition])

  if (!isLatestEdition) {
    return (
      <div style={containerStyle}>
        {/* Archive icon */}
        <div style={iconCircleStyle}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-4" />
          </svg>
        </div>

        <h1 style={titleStyle}>That&apos;s this edition</h1>

        <p style={subtitleStyle}>There&apos;s a newer edition available</p>

        <button onClick={onNewEdition} style={buttonStyle}>
          Go to latest
        </button>

        <button
          onClick={onReplay}
          style={{ ...buttonStyle, marginTop: '12px', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}
        >
          Watch again
        </button>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Checkmark icon */}
      <div style={iconCircleStyle}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 style={titleStyle}>You&apos;re up to date</h1>

      <p style={subtitleStyle}>{checkMessage}</p>

      <button onClick={onReplay} style={buttonStyle}>
        Watch again
      </button>
    </div>
  )
}
