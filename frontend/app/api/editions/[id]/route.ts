/**
 * GET /api/editions/[id]
 * Returns a specific published edition with its videos.
 * Used when the user navigates to a previous edition.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: edition, error } = await supabase
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
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (error || !edition) {
    return NextResponse.json({ edition: null }, { status: 404 })
  }

  if (edition.videos) {
    edition.videos.sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    )
  }

  return NextResponse.json({ edition })
}
