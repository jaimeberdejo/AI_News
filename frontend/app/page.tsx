import type { Video } from '../hooks/useEdition'

async function getEditionData(): Promise<{ edition: { id: string; edition_date: string; videos: Video[] } | null }> {
  // Use absolute URL with NEXT_PUBLIC_APP_URL env var for server-side fetch,
  // or directly query Supabase. Use internal fetch for simplicity since
  // /api/today already exists and handles all logic.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/today`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    return res.json()
  } catch {
    return { edition: null }
  }
}

export default async function Home() {
  const { edition } = await getEditionData()
  const videos: Video[] = edition?.videos ?? []

  return (
    <main style={{ background: '#000', minHeight: '100dvh' }}>
      {/* VideoFeed will be added in Plan 02 */}
      {/* Placeholder confirms data flow works */}
      <div style={{ color: 'white', padding: '1rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
        <p>Edition: {edition ? edition.edition_date : 'none'}</p>
        <p>Videos: {videos.length}</p>
      </div>
    </main>
  )
}
