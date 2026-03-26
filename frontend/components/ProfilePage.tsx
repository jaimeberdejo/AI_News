'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { VideoGrid, type GridVideo } from './VideoGrid'
import { EditNameSheet } from './EditNameSheet'

export function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [profile, setProfile] = useState<{
    display_name: string | null
    avatar_url: string | null
  } | null>(null)
  const [likedVideos, setLikedVideos] = useState<GridVideo[]>([])
  const [savedVideos, setSavedVideos] = useState<GridVideo[]>([])
  const [activeTab, setActiveTab] = useState<'liked' | 'saved'>('liked')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingTab, setIsLoadingTab] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [savedLoaded, setSavedLoaded] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)

  // Hidden file input ref for future avatar upload (Plan 03)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch profile + initial liked videos on mount when signed in
  useEffect(() => {
    if (!user) return

    setIsLoadingProfile(true)
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile({
          display_name: data.display_name ?? null,
          avatar_url: data.avatar_url ?? null,
        })
      })
      .catch(() => {
        setProfile({ display_name: null, avatar_url: null })
      })
      .finally(() => {
        setIsLoadingProfile(false)
      })

    // Also fetch liked videos immediately (default tab)
    setIsLoadingTab(true)
    fetch('/api/profile/liked')
      .then(r => r.json())
      .then(data => {
        setLikedVideos(data.videos ?? [])
      })
      .catch(() => {
        setLikedVideos([])
      })
      .finally(() => {
        setIsLoadingTab(false)
      })
  }, [user])

  // Lazy fetch saved videos when switching to saved tab for the first time
  useEffect(() => {
    if (activeTab !== 'saved' || savedLoaded || !user) return

    setIsLoadingTab(true)
    fetch('/api/profile/saved')
      .then(r => r.json())
      .then(data => {
        setSavedVideos(data.videos ?? [])
        setSavedLoaded(true)
      })
      .catch(() => {
        setSavedVideos([])
        setSavedLoaded(true)
      })
      .finally(() => {
        setIsLoadingTab(false)
      })
  }, [activeTab, savedLoaded, user])

  async function handleSaveName(newName: string) {
    const previousName = profile?.display_name ?? null
    // Optimistic update
    setProfile(prev => (prev ? { ...prev, display_name: newName } : prev))
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: newName }),
    })
    if (!res.ok) {
      // Rollback on failure
      setProfile(prev => (prev ? { ...prev, display_name: previousName } : prev))
    }
  }

  const displayName =
    profile?.display_name ?? user?.email?.split('@')[0] ?? 'User'

  // --- Loading state ---
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    )
  }

  // --- Signed-out state ---
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          paddingBottom: '80px', // clear TabBar
        }}
      >
        {/* Avatar placeholder */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
            margin: 0,
            padding: '0 32px',
          }}
        >
          Sign in to view your profile
        </p>

        <button
          onClick={() => router.push('/auth/login')}
          style={{
            background: 'white',
            border: 'none',
            borderRadius: '10px',
            color: '#000',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '12px 32px',
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </div>
    )
  }

  // --- Signed-in state ---
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#000',
        paddingBottom: '80px', // clear TabBar height + safe area
      }}
    >
      {/* Profile header */}
      <div
        style={{
          padding: '20px 18px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Avatar circle with camera badge hint */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {profile?.avatar_url ? (
            <img
              src={`${profile.avatar_url}?t=${avatarVersion}`}
              alt={displayName}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: 600,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {displayName[0].toUpperCase()}
            </div>
          )}

          {/* Camera badge — signals avatar is tappable (Plan 03 wires actual upload) */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#333',
              border: '1.5px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>

        {/* Display name + pencil */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isLoadingProfile ? (
            <div
              style={{
                height: '18px',
                width: '120px',
                background: '#222',
                borderRadius: '4px',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  color: 'white',
                  fontSize: '17px',
                  fontWeight: 600,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </span>
              <button
                onClick={() => setEditSheetOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'rgba(255,255,255,0.45)',
                  flexShrink: 0,
                }}
                aria-label="Edit display name"
              >
                {/* Pencil icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input for avatar upload (wired in Plan 03) */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={() => {
            // Plan 03: handle upload here
            setAvatarVersion(v => v + 1)
          }}
        />
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {(['liked', 'saved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab
                ? '2px solid white'
                : '2px solid transparent',
              color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.45)',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 600 : 400,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              padding: '12px 0',
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'liked' ? (
          <VideoGrid
            videos={likedVideos}
            emptyIcon="heart"
            emptyMessage="No liked videos yet"
            emptyCtaLabel="Start watching"
            isLoading={isLoadingTab && likedVideos.length === 0}
          />
        ) : (
          <VideoGrid
            videos={savedVideos}
            emptyIcon="bookmark"
            emptyMessage="No saved videos yet"
            emptyCtaLabel="Start watching"
            isLoading={isLoadingTab && savedVideos.length === 0}
          />
        )}
      </div>

      {/* Edit name sheet */}
      <EditNameSheet
        isOpen={editSheetOpen}
        currentName={profile?.display_name ?? displayName}
        onClose={() => setEditSheetOpen(false)}
        onSave={handleSaveName}
      />
    </div>
  )
}
