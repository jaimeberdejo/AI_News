'use client'

import React from 'react'
import { useVideoPlayer } from '../hooks/useVideoPlayer'
import type { Video } from '../hooks/useEdition'

interface VideoItemProps {
  video: Video
  isMuted: boolean
  isActive?: boolean
  preloadOnly?: boolean
  onEnded?: () => void
  onBecomeActive?: () => void
  videoRefOverride?: React.RefObject<HTMLVideoElement | null>
}

export function VideoItem({
  video,
  isMuted,
  isActive,
  preloadOnly,
  onEnded,
  onBecomeActive,
  videoRefOverride,
}: VideoItemProps) {
  // Pass videoRefOverride into the hook so the IntersectionObserver targets the
  // same element the <video> tag is attached to. Without this, play/pause calls
  // inside the observer fire on the hook's internal ref (null) while the actual
  // element is attached to videoRefOverride — causing second+ videos to never play.
  const { containerRef, videoRef: internalRef } = useVideoPlayer(isMuted, onBecomeActive, videoRefOverride)
  const videoRef = videoRefOverride ?? internalRef

  return (
    <div
      ref={containerRef}
      className="feed-item"
      style={
        preloadOnly
          ? {
              // Keep in DOM for iOS buffering. visibility:hidden (not display:none)
              // so iOS layout engine considers the element on-screen and buffers it.
              // Position it as a 1px fixed element so it doesn't affect scroll snap.
              position: 'fixed',
              top: 0,
              left: 0,
              width: '1px',
              height: '1px',
              visibility: 'hidden',
              pointerEvents: 'none',
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <video
        ref={videoRef}
        src={`${video.video_url}#t=0.001`}
        autoPlay={isActive}
        muted // HTML attribute default; JS sets .muted dynamically on intersect
        playsInline
        preload="auto"
        loop={false}
        onEnded={onEnded}
        style={
          preloadOnly
            ? { display: 'block' }
            : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
        }
      />

      {!preloadOnly && (
        /* Headline overlay — only shown for active/scrollable items */
        <div
          className="absolute bottom-0 left-0 right-0 px-4 text-white"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)',
            paddingTop: '48px',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
          }}
        >
          <p className="text-sm font-semibold leading-snug line-clamp-2">{video.headline}</p>
        </div>
      )}
    </div>
  )
}
