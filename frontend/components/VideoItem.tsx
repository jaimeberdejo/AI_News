'use client'

import React from 'react'
import type { Video } from '../hooks/useEdition'

interface VideoItemProps {
  video: Video
  onEnded?: () => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
  editionPublishedAt?: string | null
}

function formatDateTime(publishedAt: string | null | undefined): string {
  if (!publishedAt) return ''
  const date = new Date(publishedAt)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Hoy · ${time}`
  if (isYesterday) return `Ayer · ${time}`
  return (
    date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ` · ${time}`
  )
}

// Pure layout component. Play/pause and activeIndex tracking are handled
// entirely in VideoFeed (scroll event + useEffect). This keeps VideoItem
// free of hooks and avoids stale-closure issues with IntersectionObserver.
export function VideoItem({ video, onEnded, videoRef, editionPublishedAt }: VideoItemProps) {
  const dateLabel = formatDateTime(editionPublishedAt)

  return (
    <div className="feed-item">
      {/* Video — fills all height above the info panel */}
      <div style={{ flex: '1 1 0', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        <video
          ref={videoRef}
          src={`${video.video_url}#t=0.001`}
          muted
          playsInline
          preload="auto"
          loop={false}
          onEnded={onEnded}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* Info panel — date/time, headline, link to original article */}
      <div
        style={{
          flex: '0 0 auto',
          background: '#111',
          padding: '14px 18px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {dateLabel && (
          <p
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '6px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {dateLabel}
          </p>
        )}

        <p
          style={{
            color: 'white',
            fontSize: '0.95rem',
            fontWeight: 600,
            lineHeight: 1.35,
            marginBottom: '10px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {video.headline}
        </p>

        {video.source_url && (
          <a
            href={video.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.8rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Leer artículo completo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}
