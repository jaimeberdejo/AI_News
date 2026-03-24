'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  // undefined = loading (not yet resolved)
  // null     = signed out (confirmed guest)
  // User     = signed in
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()

    // getUser() validates with Supabase server — NOT getSession() which reads stale local storage
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    // Subscribe to live auth state changes (e.g. after OAuth return to same SPA instance)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    isGuest: user === null,
    loading: user === undefined,
  }
}
