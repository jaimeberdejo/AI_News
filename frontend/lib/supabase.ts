/**
 * Supabase anon-key client for frontend route handlers and server components.
 * Uses the publishable anon key — safe to expose in Next.js NEXT_PUBLIC_ vars.
 * RLS on the database restricts what the anon key can access.
 *
 * NOT @supabase/ssr — this project has no user auth sessions.
 */
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
