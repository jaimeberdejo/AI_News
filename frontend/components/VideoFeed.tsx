'use client'

import { useState } from 'react'
import type { Video } from '../hooks/useEdition'
import { VideoItem } from './VideoItem'
import { MuteButton } from './MuteButton'

interface VideoFeedProps {
  videos: Video[]
}

export function VideoFeed({ videos }: VideoFeedProps) {
  const [isMuted, setIsMuted] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showEndCard, setShowEndCard] = useState(false)

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

  function handleVideoEnded() {
    if (activeIndex < videos.length - 1) {
      setActiveIndex(prev => prev + 1)
    } else {
      setShowEndCard(true)
    }
  }

  return (
    <div className="relative">
      {/* Mute button — top-right corner, above all video items */}
      <MuteButton isMuted={isMuted} onToggle={() => setIsMuted(prev => !prev)} />

      {/* Scroll container */}
      <div className="feed-container">
        {videos.map((video, idx) => (
          <VideoItem
            key={video.id}
            video={video}
            isMuted={isMuted}
            onEnded={idx === activeIndex ? handleVideoEnded : undefined}
          />
        ))}
      </div>

      {/* EndCard placeholder — to be replaced in Plan 03 */}
      {showEndCard && (
        <div
          className="fixed inset-0 bg-black flex items-center justify-center text-white"
          style={{ zIndex: 50 }}
        >
          <p>You&apos;re up to date</p>
        </div>
      )}
    </div>
  )
}
