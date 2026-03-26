'use client'

import { useState, useEffect } from 'react'

interface EditNameSheetProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onSave: (newName: string) => void
}

export function EditNameSheet({
  isOpen,
  currentName,
  onClose,
  onSave,
}: EditNameSheetProps) {
  const [inputValue, setInputValue] = useState(currentName)

  // Sync input when sheet opens with possibly new currentName
  useEffect(() => {
    if (isOpen) {
      setInputValue(currentName)
    }
  }, [isOpen, currentName])

  const trimmed = inputValue.trim()
  const isSaveDisabled = trimmed.length === 0 || trimmed === currentName

  function handleSave() {
    if (isSaveDisabled) return
    onSave(trimmed)
    onClose()
  }

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 300,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '430px',
          margin: '0 auto',
          background: '#1a1a1a',
          borderRadius: '20px 20px 0 0',
          zIndex: 301,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle pill */}
        <div
          onClick={onClose}
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '8px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.3)',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '4px 18px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Edit Display Name
          </span>
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            maxLength={50}
            placeholder="Display name"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '1rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              padding: '12px 14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            autoFocus={isOpen}
          />
          {/* Character counter — show when close to limit */}
          {inputValue.length >= 40 && (
            <span
              style={{
                color: inputValue.length >= 48 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textAlign: 'right',
              }}
            >
              {inputValue.length}/50
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '0 18px 20px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 500,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              padding: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            style={{
              flex: 1,
              background: isSaveDisabled ? 'rgba(255,255,255,0.1)' : 'white',
              border: 'none',
              borderRadius: '10px',
              color: isSaveDisabled ? 'rgba(255,255,255,0.3)' : '#000',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              padding: '12px',
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </>
  )
}
