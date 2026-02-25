'use client'

import { useVideoPlayer } from '../hooks/useVideoPlayer'
import type { Video } from '../hooks/useEdition'

interface VideoItemProps {
  video: Video
  isMuted: boolean
  onEnded?: () => void
}

export function VideoItem({ video, isMuted, onEnded }: VideoItemProps) {
  const { containerRef, videoRef } = useVideoPlayer(isMuted)

  return (
    <div ref={containerRef} className="feed-item">
      {/* Video element — all four iOS attributes required */}
      <video
        ref={videoRef}
        src={`${video.video_url}#t=0.001`}
        autoPlay
        muted
        playsInline
        preload="auto"
        loop={false}
        onEnded={onEnded}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: 'block' }}
      />

      {/* Headline overlay — bottom of screen, respects safe-area-inset-bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-3 text-white"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)',
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}
      >
        <p className="text-sm font-semibold leading-snug line-clamp-2">{video.headline}</p>
      </div>
    </div>
  )
}
