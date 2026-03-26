import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// DELETE /api/comments/[id]
// Requires auth. Only the comment owner may delete (defense-in-depth + RLS).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Next.js 15+ params is a Promise — must be awaited before accessing properties
  const { id } = await params

  // RLS enforces auth.uid() = user_id — this delete will silently do nothing if user
  // doesn't own the comment. Return 404 in that case for clear client feedback.
  const { data, error } = await supabase
    .from('video_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)  // defense-in-depth; RLS also enforces this
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
