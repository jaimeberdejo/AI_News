import type { Video } from '../hooks/useEdition'
import { VideoFeed } from '../components/VideoFeed'

async function getEditionData() {
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
  const editionId: string | null = edition?.id ?? null

  return (
    <main>
      <VideoFeed videos={videos} editionId={editionId} />
    </main>
  )
}
