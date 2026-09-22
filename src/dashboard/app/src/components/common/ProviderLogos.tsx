import type React from 'react'

export interface ProviderLogoProps {
  id: 'claude' | 'openai' | 'codex' | 'gemini' | 'deepseek' | 'opencode' | string
  className?: string
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({ id, className = 'w-4 h-4' }) => {
  const norm = id.toLowerCase()

  if (norm.includes('claude') || norm.includes('anthropic')) {
    // Anthropic / Claude sunburst icon
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
        <circle cx="12" cy="10" r="1.5" fill="#090d16" />
      </svg>
    )
  }

  if (
    norm.includes('openai') ||
    norm.includes('chatgpt') ||
    norm.includes('codex') ||
    norm.includes('gpt')
  ) {
    // OpenAI Rosette icon
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 2a4 4 0 0 1 3.5 2.1l3 5.2a4 4 0 0 1-.8 4.7l-4.7 3.5a4 4 0 0 1-5 0L3.3 14a4 4 0 0 1-.8-4.7l3-5.2A4 4 0 0 1 9 2h3z" />
        <path d="M12 6v6l4.5 2.5" />
      </svg>
    )
  }

  if (norm.includes('gemini') || norm.includes('google')) {
    // Google Gemini 4-pointed sparkle
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" />
      </svg>
    )
  }

  if (norm.includes('deepseek')) {
    // DeepSeek icon
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M4 14c2-4 6-8 11-8 4 0 5 3 5 6-3 0-5 2-8 3-2 1-5 2-8-1z" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
        <path d="M14 15c-1 3-3 5-6 5" />
      </svg>
    )
  }

  // Default terminal / model chip
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  )
}
