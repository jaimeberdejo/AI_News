'use client'

import React from 'react'
import type { Video } from '../hooks/useEdition'

interface VideoItemProps {
  video: Video
  onEnded?: () => void
  videoRef?: React.RefObject<HTMLVideoElement | null>
  editionPublishedAt?: string | null
  onSocialAction?: (action: 'like' | 'bookmark' | 'comment', videoId: string) => void
  // NEW in Phase 9:
  likeCount?: number
  isLiked?: boolean
  isBookmarked?: boolean
  // NEW in Phase 10:
  commentCount?: number
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
export function VideoItem({ video, onEnded, videoRef, editionPublishedAt, onSocialAction, likeCount, isLiked, isBookmarked, commentCount }: VideoItemProps) {
  const dateLabel = formatDateTime(editionPublishedAt)

  return (
    <div className="feed-item" style={{ position: 'relative' }}>
      {/* Video — fills entire viewport, absolutely positioned */}
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

      {/* Bottom overlay — date, headline, article link */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: '16px',
          padding: '16px 16px calc(env(safe-area-inset-bottom) + 56px + 16px) 16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)',
          zIndex: 10,
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

      {/* Right-rail social column — like → bookmark → comment, vertically centered */}
      <div
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          zIndex: 10,
        }}
      >
        {/* Like button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSocialAction?.('like', video.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill={isLiked ? '#ef4444' : 'none'}
              stroke={isLiked ? '#ef4444' : 'rgba(255,255,255,0.9)'}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {likeCount ?? 0}
          </span>
        </div>

        {/* Bookmark button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSocialAction?.('bookmark', video.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill={isBookmarked ? '#facc15' : 'none'}
              stroke={isBookmarked ? '#facc15' : 'rgba(255,255,255,0.9)'}
              strokeWidth="2"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        {/* Comment button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSocialAction?.('comment', video.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {commentCount ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}
