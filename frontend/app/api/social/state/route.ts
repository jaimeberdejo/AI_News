import { createClient } from '@/lib/supabase/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ids = (searchParams.get('videoIds') ?? '').split(',').filter(Boolean)

  if (!ids.length) {
    return NextResponse.json({ likes: [], bookmarks: [], likeCounts: {} })
  }

  // like_count is public — use anon client so guests get counts without auth
  const anonClient = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: videos } = await anonClient
    .from('videos')
    .select('id, like_count')
    .in('id', ids)

  const likeCounts: Record<string, number> = {}
  ;(videos ?? []).forEach((v: { id: string; like_count: number }) => {
    likeCounts[v.id] = v.like_count
  })

  // Per-user like/bookmark state requires auth — use SSR cookie client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Guest: return counts but empty personal state
    return NextResponse.json({ likes: [], bookmarks: [], likeCounts })
  }

  const [{ data: likeRows }, { data: bookmarkRows }] = await Promise.all([
    supabase.from('video_likes').select('video_id').eq('user_id', user.id).in('video_id', ids),
    supabase.from('video_bookmarks').select('video_id').eq('user_id', user.id).in('video_id', ids),
  ])

  return NextResponse.json({
    likes: (likeRows ?? []).map((r: { video_id: string }) => r.video_id),
    bookmarks: (bookmarkRows ?? []).map((r: { video_id: string }) => r.video_id),
    likeCounts,
  })
}
