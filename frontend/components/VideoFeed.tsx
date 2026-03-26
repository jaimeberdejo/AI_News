'use client'

// Module-level muted flag — read synchronously in play() calls.
// Must NOT be React state: we need to read it inside useEffect callbacks
// without stale closure issues.
let globalMuted = true

import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import type { Video, Edition, EditionMeta } from '../hooks/useEdition'
import { VideoItem } from './VideoItem'
import { MuteButton } from './MuteButton'
import { EndCard } from './EndCard'
import { useAuth } from '../hooks/useAuth'
import { AuthBottomSheet } from './AuthBottomSheet'
import { CommentSheet } from './CommentSheet'

type Category = 'finance' | 'tech'

const CATEGORY_LABELS: Record<Category, string> = {
  finance: 'Finance',
  tech: 'Tech',
}

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
  const [category, setCategory] = useState<Category>('finance')
  const [currentEdition, setCurrentEdition] = useState<Edition | null>(initialEdition)
  const [editionList, setEditionList] = useState<EditionMeta[]>(allEditions)
  const [editionIndex, setEditionIndex] = useState(0)
  const [isLoadingEdition, setIsLoadingEdition] = useState(false)

  const [isMuted, setIsMuted] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [buttonProminent, setButtonProminent] = useState(false)
  const [sheetAction, setSheetAction] = useState<'like' | 'bookmark' | 'comment' | null>(null)
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)

  type SocialState = { likeCount: number; isLiked: boolean; isBookmarked: boolean }
  const [socialState, setSocialState] = useState<Record<string, SocialState>>({})
  const [processingLike, setProcessingLike] = useState<Set<string>>(new Set())
  const [processingBookmark, setProcessingBookmark] = useState<Set<string>>(new Set())

  const { user, isGuest, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const videos: Video[] = currentEdition?.videos ?? []

  // One ref per video element — used for play/pause and synchronous mute toggle
  const videoRefs = useRef<Array<React.RefObject<HTMLVideoElement | null>>>([])
  if (videoRefs.current.length !== videos.length) {
    videoRefs.current = videos.map(() => React.createRef<HTMLVideoElement>())
  }

  // Ref to the scroll container for scroll-event index tracking
  const feedRef = useRef<HTMLDivElement>(null)

  // Per-tab scroll state: preserves activeIndex and scrollTop when switching categories
  const tabScrollState = useRef<Record<Category, { activeIndex: number; scrollTop: number }>>({
    finance: { activeIndex: 0, scrollTop: 0 },
    tech: { activeIndex: 0, scrollTop: 0 },
  })

  // ── Index tracking via scroll ────────────────────────────────────────────
  // More reliable than IntersectionObserver for scroll-snap feeds:
  // each item is exactly clientHeight tall, so Math.round(scrollTop/clientHeight)
  // gives the correct index. This drives progress dots AND play/pause.
  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return

    const handleScroll = () => {
      const index = Math.round(feed.scrollTop / feed.clientHeight)
      setActiveIndex(index)
    }

    feed.addEventListener('scroll', handleScroll, { passive: true })
    return () => feed.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Play / pause driven by activeIndex ───────────────────────────────────
  // When activeIndex changes (user scrolled), pause all other videos and
  // play the current one. Uses the module-level globalMuted flag so this
  // effect doesn't need isMuted in its deps (avoids re-creating on every toggle).
  useEffect(() => {
    videoRefs.current.forEach((ref, idx) => {
      if (!ref.current) return
      if (idx === activeIndex) {
        ref.current.muted = globalMuted
        ref.current.play().catch(() => {})
      } else {
        ref.current.pause()
      }
    })
  // currentEdition?.id re-triggers play when a new edition loads after category switch
  // (activeIndex stays 0 in that case, so the dep alone wouldn't fire again)
  }, [activeIndex, currentEdition?.id])

  // ── Edition switching ────────────────────────────────────────────────────
  const switchEdition = useCallback(async (newIndex: number) => {
    const target = editionList[newIndex]
    if (!target) return
    setIsLoadingEdition(true)
    setEditionIndex(newIndex)
    try {
      const res = await fetch(`/api/editions/${target.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.edition) {
        setCurrentEdition(data.edition)
        setActiveIndex(0)
        if (feedRef.current) feedRef.current.scrollTop = 0
      }
    } catch {
      // stay on current edition
    } finally {
      setIsLoadingEdition(false)
    }
  }, [editionList])

  // ── Category switching ───────────────────────────────────────────────────
  const switchCategory = useCallback(async (next: Category) => {
    if (next === category) return

    // Save current tab's scroll state
    tabScrollState.current[category] = {
      activeIndex,
      scrollTop: feedRef.current?.scrollTop ?? 0,
    }

    setCategory(next)
    setIsLoadingEdition(true)
    setEditionIndex(0)

    // Restore saved scroll state for the next tab
    const saved = tabScrollState.current[next]
    setActiveIndex(saved.activeIndex)
    if (feedRef.current) feedRef.current.scrollTop = saved.scrollTop

    try {
      const res = await fetch(`/api/today?category=${next}`, { cache: 'no-store' })
      const data = await res.json()
      setCurrentEdition(data.edition ?? null)
      setEditionList(data.all_editions ?? [])
      // After edition loads, restore scroll to saved position
      // Use requestAnimationFrame to wait for DOM to update with new videos
      requestAnimationFrame(() => {
        if (feedRef.current) feedRef.current.scrollTop = saved.scrollTop
        setActiveIndex(saved.activeIndex)
      })
    } catch {
      // stay on current
    } finally {
      setIsLoadingEdition(false)
    }
  }, [category, activeIndex])

  const isEmpty = videos.length === 0 && !isLoadingEdition

  // CRITICAL: fully synchronous, no async. iOS requires .muted inside the
  // user-gesture call stack or the browser ignores it.
  function handleMuteToggle() {
    const newMuted = !isMuted
    globalMuted = newMuted
    videoRefs.current.forEach(ref => {
      if (ref.current) ref.current.muted = newMuted
    })
    setIsMuted(newMuted)
  }

  function handleScreenTap(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return
    setButtonProminent(true)
    setTimeout(() => setButtonProminent(false), 2000)
  }

  function handleReplay() {
    setActiveIndex(0)
    videoRefs.current.forEach(ref => {
      if (ref.current) {
        ref.current.currentTime = 0
        ref.current.pause()
      }
    })
    if (feedRef.current) feedRef.current.scrollTop = 0
  }

  function handleNewEdition() {
    switchEdition(0)
  }

  async function handleLike(videoId: string) {
    if (processingLike.has(videoId)) return
    setProcessingLike(s => new Set(s).add(videoId))

    const prev = socialState[videoId] ?? { likeCount: 0, isLiked: false, isBookmarked: false }
    const optimistic: SocialState = {
      ...prev,
      isLiked: !prev.isLiked,
      likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
    }
    setSocialState(s => ({ ...s, [videoId]: optimistic }))

    const res = await fetch('/api/social/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
    if (!res.ok) {
      setSocialState(s => ({ ...s, [videoId]: prev })) // roll back on failure
    }

    setProcessingLike(s => { const n = new Set(s); n.delete(videoId); return n })
  }

  async function handleBookmark(videoId: string) {
    if (processingBookmark.has(videoId)) return
    setProcessingBookmark(s => new Set(s).add(videoId))

    const prev = socialState[videoId] ?? { likeCount: 0, isLiked: false, isBookmarked: false }
    const optimistic: SocialState = {
      ...prev,
      isBookmarked: !prev.isBookmarked,
    }
    setSocialState(s => ({ ...s, [videoId]: optimistic }))

    const res = await fetch('/api/social/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
    if (!res.ok) {
      setSocialState(s => ({ ...s, [videoId]: prev })) // roll back
    }

    setProcessingBookmark(s => { const n = new Set(s); n.delete(videoId); return n })
  }

  function handleSocialAction(action: 'like' | 'bookmark' | 'comment', videoId: string) {
    if (authLoading) return  // debounce: auth state not yet known
    if (isGuest) {
      setSheetAction(action)
      return
    }
    // Signed in: dispatch real handlers
    if (action === 'like') handleLike(videoId)
    if (action === 'bookmark') handleBookmark(videoId)
    if (action === 'comment') setCommentVideoId(videoId)
  }

  // Scroll restoration after OAuth return — reads ?videoIndex= param, scrolls to
  // the video the user was watching, then cleans the URL. Runs once after videos load.
  useEffect(() => {
    const idx = searchParams.get('videoIndex')
    if (idx !== null && feedRef.current && videos.length > 0) {
      const target = parseInt(idx, 10)
      if (!isNaN(target) && target >= 0 && target < videos.length) {
        feedRef.current.scrollTop = target * feedRef.current.clientHeight
        setActiveIndex(target)
      }
      router.replace('/', { scroll: false })
    }
  }, [videos.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentional: only run once after videos load, not on every searchParams change.
  // router and searchParams are stable references — adding them causes double-fire.

  // Load social state (like counts + per-user liked/bookmarked) after auth resolves.
  // Deps: user?.id (stable string identity, not object ref) + videos.length (triggers after edition switch).
  // Guests never trigger the per-user queries — server returns empty likes/bookmarks for them.
  useEffect(() => {
    if (videos.length === 0) return
    const ids = videos.map(v => v.id).join(',')
    fetch(`/api/social/state?videoIds=${ids}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, SocialState> = {}
        videos.forEach(v => {
          map[v.id] = {
            likeCount: data.likeCounts?.[v.id] ?? v.like_count ?? 0,
            isLiked: data.likes?.includes(v.id) ?? false,
            isBookmarked: data.bookmarks?.includes(v.id) ?? false,
          }
        })
        setSocialState(map)
      })
      .catch(() => {
        // On error, seed from video.like_count so guests still see counts
        const map: Record<string, SocialState> = {}
        videos.forEach(v => {
          map[v.id] = { likeCount: v.like_count ?? 0, isLiked: false, isBookmarked: false }
        })
        setSocialState(map)
      })
  }, [user?.id, videos.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // user?.id: string stable identity (not object ref) re-triggers after sign-in / sign-out.
  // videos.length: triggers after edition switch. Full videos array excluded to avoid re-fetch on every render.

  const hasMultipleEditions = editionList.length > 1
  const isLatest = editionIndex === 0
  const isOldest = editionIndex === editionList.length - 1

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
      {/* Category tab bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
          paddingBottom: '8px',
          paddingLeft: '16px',
          paddingRight: '16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([cat, label]) => (
            <button
              key={cat}
              onClick={e => { e.stopPropagation(); switchCategory(cat) }}
              disabled={isLoadingEdition}
              style={{
                border: 'none',
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '0.82rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: 'pointer',
                background: cat === category ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.15)',
                color: cat === category ? '#000' : '#fff',
                fontWeight: cat === category ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Edition navigation bar */}
      {hasMultipleEditions && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: 'calc(env(safe-area-inset-top) + 50px)',
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
            }}
          >
            ← Anterior
          </button>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {isLoadingEdition ? 'Cargando…' : editionList[editionIndex] ? formatEditionLabel(editionList[editionIndex]) : ''}
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
              ? 'calc(env(safe-area-inset-top) + 96px)'
              : 'calc(env(safe-area-inset-top) + 58px)',
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
                background: idx === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
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
            ? 'calc(env(safe-area-inset-top) + 90px)'
            : 'calc(env(safe-area-inset-top) + 52px)',
          right: '12px',
          zIndex: 40,
        }}
      >
        <MuteButton isMuted={isMuted} onToggle={handleMuteToggle} prominent={buttonProminent} />
      </div>

      {/* Scroll container — always mounted so feedRef + scroll listener are stable */}
      <div ref={feedRef} className="feed-container">
        {isEmpty ? (
          /* Empty state as a single snap-item so the container still has content */
          <div className="feed-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '32px', color: 'white' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif' }}>No hay vídeos todavía</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Vuelve pronto</p>
            </div>
          </div>
        ) : (
          <>
            {videos.map((video, idx) => (
              <VideoItem
                key={video.id}
                video={video}
                onEnded={idx === videos.length - 1 ? () => {
                  const feed = feedRef.current
                  if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' })
                } : undefined}
                videoRef={videoRefs.current[idx]}
                editionPublishedAt={currentEdition?.published_at}
                onSocialAction={handleSocialAction}
                likeCount={socialState[video.id]?.likeCount ?? video.like_count ?? 0}
                isLiked={socialState[video.id]?.isLiked ?? false}
                isBookmarked={socialState[video.id]?.isBookmarked ?? false}
                commentCount={video.comment_count}
              />
            ))}
            {/* End card as a scroll item — reachable by scrolling or auto-scrolled to on last video end */}
            <div className="feed-item" style={{ position: 'relative' }}>
              <EndCard
                onReplay={handleReplay}
                currentEditionId={currentEdition?.id ?? null}
                onNewEdition={handleNewEdition}
                isActive={activeIndex === videos.length}
                isLatestEdition={isLatest}
              />
            </div>
          </>
        )}
      </div>

      {/* Auth bottom sheet — one instance at feed level, controlled by sheetAction state */}
      <AuthBottomSheet
        isOpen={sheetAction !== null}
        actionLabel={
          sheetAction === 'like' ? 'like this' :
          sheetAction === 'bookmark' ? 'bookmark this' :
          'comment'
        }
        returnPath={`/?videoIndex=${activeIndex}`}
        onClose={() => setSheetAction(null)}
      />

      {/* Comment sheet — one instance at feed level, opens for signed-in users */}
      <CommentSheet
        isOpen={commentVideoId !== null}
        videoId={commentVideoId}
        currentUserId={user?.id ?? null}
        onClose={() => setCommentVideoId(null)}
      />
    </div>
  )
}
