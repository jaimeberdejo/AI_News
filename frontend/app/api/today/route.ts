/**
 * GET /api/today
 * Returns the most recent published edition with its videos, plus metadata
 * for all published editions (for the edition navigation bar).
 * Always returns 200 — { edition: null, all_editions: [] } if nothing published yet.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? 'finance'

  const supabase = getSupabase()

  // Latest edition with full video data
  const { data: edition, error } = await supabase
    .from('editions')
    .select(`
      id,
      edition_date,
      status,
      published_at,
      category,
      videos (
        id,
        position,
        headline,
        source_url,
        video_url,
        duration
      )
    `)
    .in('status', ['published', 'partial'])
    .eq('category', category)
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  // All published editions — metadata only (for the edition picker)
  const { data: allEditions } = await supabase
    .from('editions')
    .select('id, published_at, edition_date, category')
    .in('status', ['published', 'partial'])
    .eq('category', category)
    .order('published_at', { ascending: false })

  if (error || !edition) {
    return NextResponse.json({ edition: null, all_editions: [] })
  }

  if (edition.videos) {
    edition.videos.sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    )
  }

  return NextResponse.json({ edition, all_editions: allEditions ?? [] })
}
