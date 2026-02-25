'use client'

import { useEffect, useState } from 'react'

interface EndCardProps {
  onReplay: () => void
  currentEditionId: string | null
  onNewEdition: () => void
}

function getNextEditionMessage(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Check back this morning'
  if (hour < 12) return 'Check back this afternoon'
  if (hour < 18) return 'Check back tonight'
  return 'Check back tomorrow morning'
}

export function EndCard({ onReplay, currentEditionId, onNewEdition }: EndCardProps) {
  const [checkMessage] = useState(getNextEditionMessage)

  // Silent new-edition detection: poll /api/today once on mount.
  // If a different (newer) edition is available, call onNewEdition() to silently
  // refresh the feed — user doesn't see a loading state, the page just reloads.
  useEffect(() => {
    let cancelled = false

    async function checkForNewEdition() {
      try {
        const res = await fetch('/api/today', { cache: 'no-store' })
        const data = await res.json()
        const latestId: string | null = data?.edition?.id ?? null

        if (!cancelled && latestId && latestId !== currentEditionId) {
          // A newer edition is available — silently refresh
          onNewEdition()
        }
      } catch {
        // Network error — do nothing, user stays on end card
      }
    }

    checkForNewEdition()
    return () => {
      cancelled = true
    }
  }, [currentEditionId, onNewEdition])

  return (
    <div
      style={{
        position: 'fixed',
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
      }}
    >
      {/* Checkmark icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Main message */}
      <h1
        style={{
          color: 'white',
          fontSize: '1.5rem',
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        You&apos;re up to date
      </h1>

      {/* Time estimate — human-readable, not a countdown */}
      <p
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.9rem',
          textAlign: 'center',
          marginBottom: '48px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {checkMessage}
      </p>

      {/* Watch again button */}
      <button
        onClick={onReplay}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          borderRadius: '24px',
          padding: '12px 32px',
          fontSize: '0.9rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          cursor: 'pointer',
          letterSpacing: '0.03em',
        }}
      >
        Watch again
      </button>
    </div>
  )
}
