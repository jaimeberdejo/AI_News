/**
 * GET /api/today
 * Returns the most recent published edition with its videos sorted by position.
 * Always returns 200 — { edition: null } if no published edition exists yet
 * (better UX than 404 during pipeline window).
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create client inside handler to ensure env vars are available at request time
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('editions')
    .select(`
      id,
      edition_date,
      status,
      published_at,
      videos (
        id,
        position,
        headline,
        source_url,
        video_url,
        duration
      )
    `)
    .eq('status', 'published')
    .order('edition_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    // Return 200 with null edition — frontend handles "no edition yet" gracefully
    return NextResponse.json({ edition: null })
  }

  // Sort videos by position (1-5) before returning
  if (data.videos) {
    data.videos.sort((a: { position: number }, b: { position: number }) => a.position - b.position)
  }

  return NextResponse.json({ edition: data })
}
