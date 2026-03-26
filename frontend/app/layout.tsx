import type { Metadata, Viewport } from 'next'
import './globals.css'
import { TabBar } from '../components/TabBar'

export const metadata: Metadata = {
  title: 'FinFeed',
  description: 'Your daily financial briefing',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FinFeed',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000' }}>
        {children}
        <TabBar />
      </body>
    </html>
  )
}
