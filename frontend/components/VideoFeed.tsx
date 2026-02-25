'use client'

// Module-level flag: read synchronously in IntersectionObserver callbacks.
// DO NOT store this in React state — IntersectionObserver callbacks run outside
// React's render cycle and cannot read stale closure state reliably.
let globalMuted = true

import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'
import type { Video, Edition, EditionMeta } from '../hooks/useEdition'
import { VideoItem } from './VideoItem'
import { MuteButton } from './MuteButton'
import { EndCard } from './EndCard'

interface VideoFeedProps {
  initialEdition: Edition | null
  allEditions: EditionMeta[]
}

function formatEditionLabel(meta: EditionMeta): string {
  if (!meta.published_at) return meta.edition_date
  const date = new Date(meta.published_at)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Hoy ${time}`
  if (isYesterday) return `Ayer ${time}`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ` ${time}`
}

export function VideoFeed({ initialEdition, allEditions }: VideoFeedProps) {
  const [currentEdition, setCurrentEdition] = useState<Edition | null>(initialEdition)
  const [editionIndex, setEditionIndex] = useState(0) // 0 = latest (allEditions[0])
  const [isLoadingEdition, setIsLoadingEdition] = useState(false)

  const [isMuted, setIsMuted] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showEndCard, setShowEndCard] = useState(false)
  const [buttonProminent, setButtonProminent] = useState(false)

  const videos: Video[] = currentEdition?.videos ?? []

  const videoRefs = useRef<Array<React.RefObject<HTMLVideoElement | null>>>([])
  if (videoRefs.current.length !== videos.length) {
    videoRefs.current = videos.map(() => React.createRef<HTMLVideoElement>())
  }

  // Switch to a different edition by index in allEditions (0 = latest)
  const switchEdition = useCallback(async (newIndex: number) => {
    const target = allEditions[newIndex]
    if (!target) return
    setIsLoadingEdition(true)
    setEditionIndex(newIndex)
    try {
      const res = await fetch(`/api/editions/${target.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.edition) {
        setCurrentEdition(data.edition)
        setActiveIndex(0)
        setShowEndCard(false)
        // Scroll feed back to top
        const feed = document.querySelector('.feed-container')
        if (feed) feed.scrollTop = 0
      }
    } catch {
      // silently fail — stay on current edition
    } finally {
      setIsLoadingEdition(false)
    }
  }, [allEditions])

  if (videos.length === 0 && !isLoadingEdition) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: 'white', textAlign: 'center', padding: '32px' }}>
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>No hay vídeos todavía</p>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Vuelve pronto</p>
        </div>
      </div>
    )
  }

  function handleMuteToggle() {
    const newMuted = !isMuted
    globalMuted = newMuted
    videoRefs.current.forEach(ref => {
      if (ref.current) ref.current.muted = newMuted
    })
    setIsMuted(newMuted)
  }

  function handleVideoEnded() {
    if (activeIndex < videos.length - 1) {
      setActiveIndex(prev => prev + 1)
    } else {
      setShowEndCard(true)
    }
  }

  function handleScreenTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return
    setButtonProminent(true)
    setTimeout(() => setButtonProminent(false), 2000)
  }

  function handleReplay() {
    setShowEndCard(false)
    setActiveIndex(0)
    videoRefs.current.forEach(ref => {
      if (ref.current) {
        ref.current.currentTime = 0
        ref.current.pause()
      }
    })
    const feedContainer = document.querySelector('.feed-container')
    if (feedContainer) feedContainer.scrollTop = 0
  }

  function handleNewEdition() {
    window.location.reload()
  }

  const hasMultipleEditions = allEditions.length > 1
  const isLatest = editionIndex === 0
  const isOldest = editionIndex === allEditions.length - 1

  return (
    <div
      style={{
        position: 'relative',
        height: '100dvh',
        maxWidth: '430px',
        margin: '0 auto',
        overflow: 'hidden',
        background: '#000',
      }}
      onClick={handleScreenTap}
    >
      {/* Edition navigation bar — shown only when multiple editions exist */}
      {hasMultipleEditions && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
            paddingBottom: '8px',
            paddingLeft: '12px',
            paddingRight: '12px',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); switchEdition(editionIndex + 1) }}
            disabled={isOldest || isLoadingEdition}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '20px',
              color: isOldest ? 'rgba(255,255,255,0.2)' : 'white',
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              cursor: isOldest ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← Anterior
          </button>

          <span
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.78rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '0.02em',
            }}
          >
            {isLoadingEdition
              ? 'Cargando…'
              : allEditions[editionIndex]
              ? formatEditionLabel(allEditions[editionIndex])
              : ''}
          </span>

          <button
            onClick={e => { e.stopPropagation(); switchEdition(editionIndex - 1) }}
            disabled={isLatest || isLoadingEdition}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '20px',
              color: isLatest ? 'rgba(255,255,255,0.2)' : 'white',
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              cursor: isLatest ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Progress dots */}
      {videos.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: hasMultipleEditions
              ? 'calc(env(safe-area-inset-top) + 46px)'
              : 'calc(env(safe-area-inset-top) + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            display: 'flex',
            gap: '5px',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {videos.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx === activeIndex ? '20px' : '6px',
                height: '3px',
                borderRadius: '2px',
                background:
                  idx === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Mute button */}
      <div
        style={{
          position: 'absolute',
          top: hasMultipleEditions
            ? 'calc(env(safe-area-inset-top) + 40px)'
            : 'calc(env(safe-area-inset-top) + 8px)',
          right: '12px',
          zIndex: 40,
        }}
      >
        <MuteButton isMuted={isMuted} onToggle={handleMuteToggle} prominent={buttonProminent} />
      </div>

      {/* Scroll container */}
      <div className="feed-container">
        {videos.map((video, idx) => {
          const isActive = idx === activeIndex

          return (
            <VideoItem
              key={video.id}
              video={video}
              isMuted={isMuted}
              isActive={isActive}
              onEnded={isActive ? handleVideoEnded : undefined}
              onBecomeActive={() => setActiveIndex(idx)}
              videoRefOverride={videoRefs.current[idx]}
              editionPublishedAt={currentEdition?.published_at}
            />
          )
        })}
      </div>

      {/* End card — position absolute so it stays within the 430px column */}
      {showEndCard && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
          <EndCard
            onReplay={handleReplay}
            currentEditionId={currentEdition?.id ?? null}
            onNewEdition={handleNewEdition}
          />
        </div>
      )}
    </div>
  )
}
