import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('video_bookmarks')
    .select('created_at, videos(id, headline, video_url, thumbnail_url, edition_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const videos = (data ?? [])
    .filter((row) => row.videos !== null)
    .map((row) => ({
      ...(row.videos as unknown as { id: string; headline: string; video_url: string; thumbnail_url: string | null; edition_id: string }),
      savedAt: row.created_at,
    }))

  return NextResponse.json({ videos })
}
