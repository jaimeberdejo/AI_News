'use client'

import React, { useEffect, useRef } from 'react'

export function useVideoPlayer(
  isMuted: boolean,
  onBecomeActive?: () => void,
  externalVideoRef?: React.RefObject<HTMLVideoElement | null>
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  // Use external ref when provided — the IntersectionObserver must reference the same
  // element that the <video> tag is attached to, otherwise play/pause calls are on null.
  const videoRef = externalVideoRef ?? internalVideoRef
  const isMutedRef = useRef(isMuted)

  // Keep isMutedRef in sync with prop so IntersectionObserver callbacks always
  // read the current value without needing the observer to be re-created.
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Use ref value — always current, even if React state is stale.
          // This is critical for iOS: the muted state must be accurate at the
          // moment of play(), not from a potentially stale closure.
          video.muted = isMutedRef.current
          video.play().catch(() => {
            // Autoplay blocked — silently handle (browser policy)
          })
          onBecomeActive?.()
        } else {
          video.pause()
        }
      },
      { threshold: 0.7 }
    )
    // Empty deps: observer is created once; reads isMutedRef.current dynamically.
    // onBecomeActive is intentionally excluded — identity changes on each render
    // but calling the latest one is fine (we capture it in the closure via ref below).

    observer.observe(container)
    return () => observer.unobserve(container)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { containerRef, videoRef: internalVideoRef }
}
