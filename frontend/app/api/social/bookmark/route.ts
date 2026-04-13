import { createClient } from '@/lib/supabase/server'
import { isUUID } from '@/lib/validate'
import { NextResponse } from 'next/server'

const RATE_LIMIT_MS = 1_000

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { videoId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const videoId = body?.videoId
  if (!isUUID(videoId)) {
    return NextResponse.json({ error: 'videoId must be a valid UUID' }, { status: 400 })
  }

  // Rate limit: 1 bookmark-toggle per second per user
  const cutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString()
  const { data: recent } = await supabase
    .from('video_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()
  if (recent) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Check-then-act toggle
  const { data: existing } = await supabase
    .from('video_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle()

  if (existing) {
    await supabase.from('video_bookmarks').delete()
      .eq('user_id', user.id)
      .eq('video_id', videoId)
    return NextResponse.json({ bookmarked: false })
  }

  const { error } = await supabase
    .from('video_bookmarks')
    .insert({ user_id: user.id, video_id: videoId })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ bookmarked: true })
}
