'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// AUTH-01: Sign up with email and password
// Sends a confirmation email; user lands on / after clicking the link (via /auth/confirm)
export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) throw new Error(error.message)

  // Return instead of redirect so the UI can show "check your email" message
  return { message: 'Check your email to confirm your account.' }
}

// AUTH-02: Sign in with email and password
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) throw new Error(error.message)
  redirect('/')
}

// AUTH-04: Initiate Google OAuth sign-in
// Returns the OAuth redirect URL — the Client Component must do window.location.href = url
// NEVER use window.open() — it is broken in iOS PWA standalone mode
export async function signInWithGoogle(): Promise<{ url: string }> {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) throw new Error(error?.message ?? 'OAuth URL missing')
  return { url: data.url }
}

// AUTH-03: Request a password reset email
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get('email') as string,
    {
      redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
    }
  )

  if (error) throw new Error(error.message)
  return { message: 'Check your email for the reset link.' }
}

// AUTH-03 (continued): Update password after clicking reset link
// Called from the /auth/update-password page (Phase 8)
export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: formData.get('password') as string,
  })

  if (error) throw new Error(error.message)
  redirect('/')
}

// Sign out
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
