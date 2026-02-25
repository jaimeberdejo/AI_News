import type { Edition, EditionMeta } from '../hooks/useEdition'
import { VideoFeed } from '../components/VideoFeed'

async function getEditionData(): Promise<{ edition: Edition | null; allEditions: EditionMeta[] }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/today`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    const data = await res.json()
    return {
      edition: data.edition ?? null,
      allEditions: data.all_editions ?? [],
    }
  } catch {
    return { edition: null, allEditions: [] }
  }
}

export default async function Home() {
  const { edition, allEditions } = await getEditionData()

  return (
    <main>
      <VideoFeed initialEdition={edition} allEditions={allEditions} />
    </main>
  )
}
