'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Video {
  id: string
  position: number
  headline: string
  video_url: string
  duration: number | null
  source_url: string | null
}

export interface Edition {
  id: string
  edition_date: string
  status: string
  published_at: string | null
  category: string
  videos: Video[]
}

// Lightweight edition metadata — used for the edition navigation bar
export interface EditionMeta {
  id: string
  published_at: string | null
  edition_date: string
  category: string
}

interface EditionState {
  edition: Edition | null
  videos: Video[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useEdition(): EditionState {
  const [edition, setEdition] = useState<Edition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEdition = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/today', { cache: 'no-store' })
      const data = await res.json()
      setEdition(data.edition ?? null)
      setError(null)
    } catch (e) {
      setError('Failed to load edition')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEdition()
  }, [fetchEdition])

  return {
    edition,
    videos: edition?.videos ?? [],
    isLoading,
    error,
    refetch: fetchEdition,
  }
}
