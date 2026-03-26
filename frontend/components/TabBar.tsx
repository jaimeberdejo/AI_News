'use client'

import { usePathname, useRouter } from 'next/navigation'

export function TabBar() {
  const pathname = usePathname()
  const router = useRouter()

  const isHome = pathname === '/' || pathname === ''
  const isProfile = pathname === '/profile'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: '#000',
        height: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* Home tab */}
      <button
        onClick={() => router.push('/')}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          gap: '2px',
          padding: 0,
        }}
        aria-label="Home"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={isHome ? 'white' : 'none'}
          stroke={isHome ? 'white' : '#666'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span
          style={{
            fontSize: '10px',
            color: isHome ? 'white' : '#666',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Home
        </span>
      </button>

      {/* Profile tab */}
      <button
        onClick={() => router.push('/profile')}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          gap: '2px',
          padding: 0,
        }}
        aria-label="Profile"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill={isProfile ? 'white' : 'none'}
          stroke={isProfile ? 'white' : '#666'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span
          style={{
            fontSize: '10px',
            color: isProfile ? 'white' : '#666',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Profile
        </span>
      </button>
    </div>
  )
}
