export default function AuthErrorPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: '#000',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 24,
        paddingRight: 24,
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          color: '#ffffff',
          fontSize: '1.2rem',
          fontWeight: 600,
          margin: 0,
        }}
      >
        Sign-in failed
      </h1>
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.875rem',
          marginTop: 12,
          marginBottom: 0,
          lineHeight: 1.5,
        }}
      >
        Something went wrong during sign-in. Please try again.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '10px 24px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 8,
          color: '#ffffff',
          fontSize: '0.875rem',
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Back to feed
      </a>
    </div>
  )
}
