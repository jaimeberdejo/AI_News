import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { videoId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const videoId: string | undefined = body?.videoId
  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Check-then-act toggle (Supabase does not support ON CONFLICT DO DELETE)
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
  } else {
    await supabase.from('video_bookmarks').insert({ user_id: user.id, video_id: videoId })
    return NextResponse.json({ bookmarked: true })
  }
}
