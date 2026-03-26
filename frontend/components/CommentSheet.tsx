'use client'

import { useState, useEffect } from 'react'

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

interface CommentSheetProps {
  isOpen: boolean
  videoId: string | null
  currentUserId: string | null  // null = guest
  onClose: () => void
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export function CommentSheet({ isOpen, videoId, currentUserId, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Lazy load comments only when sheet opens for a given videoId
  useEffect(() => {
    if (!isOpen || !videoId) {
      if (!isOpen) {
        setComments([])
        setInput('')
        setSubmitError(null)
      }
      return
    }

    setLoading(true)
    fetch(`/api/comments?videoId=${videoId}`)
      .then(r => r.json())
      .then(data => {
        setComments(data.comments ?? [])
      })
      .catch(() => {
        setComments([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen, videoId])

  async function handleSubmit() {
    if (!input.trim() || submitting || !videoId) return

    setSubmitting(true)
    setSubmitError(null)

    // Optimistic comment — temporary id
    const tempId = `optimistic-${Date.now()}`
    const optimisticComment: Comment = {
      id: tempId,
      body: input.trim(),
      created_at: new Date().toISOString(),
      user_id: currentUserId ?? '',
      profiles: null,
    }
    setComments(prev => [optimisticComment, ...prev])
    const submittedInput = input.trim()
    setInput('')

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, body: submittedInput }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = data?.error ?? 'Failed to post comment'
        setSubmitError(message)
        // Remove optimistic comment on failure
        setComments(prev => prev.filter(c => c.id !== tempId))
        setInput(submittedInput) // restore input
        return
      }

      const data = await res.json()
      const serverComment: Comment = data.comment

      // Replace optimistic comment with server response
      setComments(prev => prev.map(c => c.id === tempId ? serverComment : c))
    } catch {
      setSubmitError('Network error. Please try again.')
      setComments(prev => prev.filter(c => c.id !== tempId))
      setInput(submittedInput)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    // Optimistically remove from list
    const prev = comments
    setComments(c => c.filter(x => x.id !== commentId))

    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) {
        // Restore on failure
        setComments(prev)
      }
    } catch {
      setComments(prev)
    }
  }

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 201,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '430px',
          margin: '0 auto',
          height: '75vh',
          background: '#1a1a1a',
          borderRadius: '20px 20px 0 0',
          zIndex: 202,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle pill */}
        <div
          onClick={onClose}
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '8px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.3)',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 18px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Comments
          </span>
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.85rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            ({comments.length})
          </span>
        </div>

        {/* Scrollable comment list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0',
          }}
          onTouchMove={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80px',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9rem',
              }}
            >
              Loading...
            </div>
          ) : comments.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80px',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '0.9rem',
                textAlign: 'center',
                padding: '0 24px',
              }}
            >
              No comments yet. Be the first!
            </div>
          ) : (
            comments.map(comment => {
              const displayName = comment.profiles?.display_name ?? 'Anonymous'
              const avatarLetter = displayName !== 'Anonymous' ? displayName[0].toUpperCase() : '?'
              const isOwn = comment.user_id === currentUserId

              return (
                <div
                  key={comment.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px 18px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Avatar circle */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {avatarLetter}
                  </div>

                  {/* Comment content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          color: 'white',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                      >
                        {displayName}
                      </span>
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.35)',
                          fontSize: '0.75rem',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                      >
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '0.9rem',
                        lineHeight: 1.4,
                        margin: 0,
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        wordBreak: 'break-word',
                      }}
                    >
                      {comment.body}
                    </p>
                  </div>

                  {/* Delete button — only for own comments */}
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'rgba(255,255,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label="Delete comment"
                    >
                      {/* Trash icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Input area */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 18px',
          }}
        >
          {currentUserId === null ? (
            <p
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.9rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: 'center',
                margin: 0,
                padding: '8px 0',
              }}
            >
              Sign in to comment
            </p>
          ) : (
            <>
              {submitError && (
                <p
                  style={{
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    marginBottom: '8px',
                    margin: '0 0 8px 0',
                  }}
                >
                  {submitError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    maxLength={500}
                    placeholder="Add a comment..."
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '0.9rem',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      padding: '10px 12px',
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '10px',
                      color: input.length >= 480 ? '#ef4444' : 'rgba(255,255,255,0.3)',
                      fontSize: '0.72rem',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      pointerEvents: 'none',
                    }}
                  >
                    {input.length}/500
                  </span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={input.trim().length === 0 || submitting}
                  style={{
                    flexShrink: 0,
                    background: input.trim().length === 0 || submitting ? 'rgba(255,255,255,0.1)' : 'white',
                    border: 'none',
                    borderRadius: '10px',
                    color: input.trim().length === 0 || submitting ? 'rgba(255,255,255,0.3)' : '#000',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '10px 16px',
                    cursor: input.trim().length === 0 || submitting ? 'not-allowed' : 'pointer',
                    height: '44px',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                >
                  {submitting ? '...' : 'Post'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
