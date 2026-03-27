import { createClient } from '@/lib/supabase/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// GET /api/comments?videoId=<uuid>
// Public — guests can read (no auth required)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  // Use anon client — comments are publicly readable, no auth needed
  const anonClient = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: comments, error } = await anonClient
    .from('video_comments')
    .select(`
      id,
      body,
      created_at,
      user_id,
      profiles ( display_name, avatar_url )
    `)
    .eq('video_id', videoId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: comments ?? [] })
}

// POST /api/comments
// Requires auth. Enforces rate limit (1 per 30s) and body length <= 500 chars.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { videoId?: string; body?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const videoId: string | undefined = body?.videoId
  const text: string | undefined = body?.body

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  if (!text || text.trim().length === 0) return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
  if (text.length > 500) return NextResponse.json({ error: 'Comment cannot exceed 500 characters.' }, { status: 400 })

  // Rate limit: max 1 comment per 30 seconds across all videos (COMM-04 cross-video enforcement)
  // NOTE: No video_id filter — rate limit is per-user, not per-video
  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
  const { data: recent } = await supabase
    .from('video_comments')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', thirtySecondsAgo)
    .limit(1)
    .maybeSingle()

  if (recent) {
    return NextResponse.json(
      { error: 'Please wait 30 seconds between comments.' },
      { status: 429 }
    )
  }

  const { data: comment, error } = await supabase
    .from('video_comments')
    .insert({ video_id: videoId, user_id: user.id, body: text.trim() })
    .select(`
      id,
      body,
      created_at,
      user_id,
      profiles ( display_name, avatar_url )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment }, { status: 201 })
}
