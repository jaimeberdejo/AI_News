'use client'

import { useRouter } from 'next/navigation'

export interface GridVideo {
  id: string
  headline: string
  video_url: string
  likedAt?: string
  savedAt?: string
  thumbnail_url?: string | null
}

interface VideoGridProps {
  videos: GridVideo[]
  emptyIcon: 'heart' | 'bookmark'
  emptyMessage: string
  emptyCtaLabel: string
  isLoading?: boolean
}

export function VideoGrid({
  videos,
  emptyIcon,
  emptyMessage,
  emptyCtaLabel,
  isLoading = false,
}: VideoGridProps) {
  const router = useRouter()

  if (isLoading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '1',
              background: '#222',
            }}
          />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 32px',
          gap: '16px',
        }}
      >
        {emptyIcon === 'heart' ? (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ) : (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <p
          style={{
            color: '#666',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {emptyMessage}
        </p>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '10px 20px',
            cursor: 'pointer',
          }}
        >
          {emptyCtaLabel}
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
      }}
    >
      {videos.map(video => (
        <div
          key={video.id}
          onClick={() => router.push(`/?videoId=${video.id}`)}
          style={{
            position: 'relative',
            aspectRatio: '1',
            cursor: 'pointer',
            overflow: 'hidden',
            background: '#111',
          }}
        >
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.headline}
              loading="lazy"
              style={{
                objectFit: 'cover',
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              <p
                style={{
                  padding: '6px',
                  fontSize: '0.65rem',
                  color: '#555',
                  lineHeight: 1.2,
                  margin: 0,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {video.headline}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
