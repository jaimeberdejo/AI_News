'use client'

import { useEffect, useRef } from 'react'

export function useVideoPlayer(isMuted: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Sync muted state from parent before playing
          video.muted = isMuted
          video.play().catch(() => {
            // Autoplay blocked — silently handle (browser policy)
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.7 }
    )

    observer.observe(container)
    return () => observer.unobserve(container)
  }, [isMuted])
  // isMuted in deps: when parent toggles mute, observer re-attaches with current value.
  // For the currently-playing video, the synchronous handler in MuteButton also sets
  // .muted directly on the ref (Plan 03). This hook handles the "start playing" sync.

  return { containerRef, videoRef }
}
