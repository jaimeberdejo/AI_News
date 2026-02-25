'use client'

// Module-level flag: read synchronously in IntersectionObserver callbacks.
// DO NOT store this in React state — IntersectionObserver callbacks run outside
// React's render cycle and cannot read stale closure state reliably.
// This is also read by the synchronous mute toggle handler for iOS compatibility.
let globalMuted = true

import { useState, useRef, useEffect } from 'react'
import React from 'react'
import type { Video } from '../hooks/useEdition'
import { VideoItem } from './VideoItem'
import { MuteButton } from './MuteButton'
import { EndCard } from './EndCard'

interface VideoFeedProps {
  videos: Video[]
  editionId?: string | null
}

export function VideoFeed({ videos, editionId = null }: VideoFeedProps) {
  const [isMuted, setIsMuted] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showEndCard, setShowEndCard] = useState(false)
  const [buttonProminent, setButtonProminent] = useState(false)

  // Array of refs — one per video element. Used to set .muted synchronously
  // on ALL video elements in the iOS unmute handler (no async boundary).
  const videoRefs = useRef<Array<React.RefObject<HTMLVideoElement | null>>>([])

  // Initialize / resize the refs array when videos change
  if (videoRefs.current.length !== videos.length) {
    videoRefs.current = videos.map(() => React.createRef<HTMLVideoElement>())
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white text-center p-8">
        <div>
          <p className="text-xl font-semibold">No videos yet</p>
          <p className="text-sm text-gray-400 mt-2">Check back soon for today&apos;s briefing</p>
        </div>
      </div>
    )
  }

  // CRITICAL: everything in this function is synchronous — no async, no await.
  // iOS requires .muted to be set within the user-gesture call stack.
  function handleMuteToggle() {
    const newMuted = !isMuted
    // 1. Update module-level flag (read by IntersectionObserver callbacks)
    globalMuted = newMuted
    // 2. Set .muted on ALL video elements synchronously (iOS requirement)
    videoRefs.current.forEach(ref => {
      if (ref.current) ref.current.muted = newMuted
    })
    // 3. Update React state for icon re-render (non-blocking, happens after)
    setIsMuted(newMuted)
  }

  function handleVideoEnded() {
    if (activeIndex < videos.length - 1) {
      setActiveIndex(prev => prev + 1)
    } else {
      setShowEndCard(true)
    }
  }

  // Screen-tap restore: when user taps anywhere except the MuteButton,
  // briefly make the button prominent (opacity 1) then fade back after 2s.
  function handleScreenTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    setButtonProminent(true)
    setTimeout(() => setButtonProminent(false), 2000)
  }

  function handleReplay() {
    setShowEndCard(false)
    setActiveIndex(0)
    // Seek all videos back to start so they replay from the beginning
    videoRefs.current.forEach(ref => {
      if (ref.current) {
        ref.current.currentTime = 0
        ref.current.pause()
      }
    })
    // Scroll the feed container back to the top (first video)
    const feedContainer = document.querySelector('.feed-container')
    if (feedContainer) feedContainer.scrollTop = 0
  }

  function handleNewEdition() {
    // End card is shown — user won't notice a reload.
    // New edition available: reload to fetch fresh data from server.
    window.location.reload()
  }

  return (
    <div className="relative" onClick={handleScreenTap}>
      {/* Progress dots — centered at top, above videos */}
      {videos.length > 1 && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            display: 'flex',
            gap: '5px',
            alignItems: 'center',
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

      {/* Mute button — top-right corner, above all video items */}
      <MuteButton isMuted={isMuted} onToggle={handleMuteToggle} prominent={buttonProminent} />

      {/* Scroll container */}
      <div className="feed-container">
        {videos.map((video, idx) => {
          const isActive = idx === activeIndex
          const isPreload = idx === activeIndex + 1 || idx === activeIndex + 2

          return (
            <VideoItem
              key={video.id}
              video={video}
              isMuted={isMuted}
              isActive={isActive}
              preloadOnly={isPreload && !isActive}
              onEnded={isActive ? handleVideoEnded : undefined}
              onBecomeActive={() => setActiveIndex(idx)}
              videoRefOverride={videoRefs.current[idx]}
            />
          )
        })}
      </div>

      {/* End card — rendered on top when all videos have played */}
      {showEndCard && (
        <EndCard
          onReplay={handleReplay}
          currentEditionId={editionId}
          onNewEdition={handleNewEdition}
        />
      )}
    </div>
  )
}
