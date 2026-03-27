import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { display_name?: unknown; avatar_url?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Whitelist only allowed fields
  const updates: { display_name?: string; avatar_url?: string } = {}

  if (body?.display_name !== undefined) {
    const trimmed = typeof body.display_name === 'string' ? body.display_name.trim() : ''
    if (trimmed.length < 1 || trimmed.length > 50) {
      return NextResponse.json(
        { error: 'display_name must be 1-50 characters' },
        { status: 400 }
      )
    }
    updates.display_name = trimmed
  }

  if (body?.avatar_url !== undefined && typeof body.avatar_url === 'string') {
    const trimmedUrl = body.avatar_url.trim()
    if (trimmedUrl && !trimmedUrl.match(/^(https?:\/\/|data:image\/)/)) {
      return NextResponse.json({ error: 'Invalid avatar_url' }, { status: 400 })
    }
    updates.avatar_url = trimmedUrl
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
