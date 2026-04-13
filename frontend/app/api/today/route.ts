/**
 * GET /api/today
 * Returns the most recent published edition with its videos, plus metadata
 * for all published editions (for the edition navigation bar).
 * Always returns 200 — { edition: null, all_editions: [] } if nothing published yet.
 *
 * Uses the anon key directly — this is a public read-only endpoint.
 * No user session is needed, and using the SSR cookie client here would
 * cause issues when called from client-side fetch (cookies() context mismatch).
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_CATEGORIES = new Set(['finance', 'tech'])

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawCategory = searchParams.get('category') ?? 'finance'
  const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'finance'

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
        duration,
        like_count,
        comment_count,
        thumbnail_url
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
    .limit(30)

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
