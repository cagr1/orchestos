import type React from 'react'
import chatgptAsset from '../../assets/providers/chatgpt.svg'
import claudeAsset from '../../assets/providers/claude.svg'
import deepseekAsset from '../../assets/providers/deepseek.svg'
import geminiAsset from '../../assets/providers/gemini.svg'
import grokAsset from '../../assets/providers/grok.svg'
import kimiAsset from '../../assets/providers/kimi.svg'
import ollamaAsset from '../../assets/providers/ollama-icon.svg'
import opencodeAsset from '../../assets/providers/opencode.svg'

export interface ProviderLogoProps {
  id:
    | 'claude'
    | 'codex'
    | 'openai'
    | 'chatgpt'
    | 'deepseek'
    | 'opencode'
    | 'gemini'
    | 'kimi'
    | 'glm'
    | string
  className?: string
  size?: number // 14 or 18 or custom
  brandColor?: boolean
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  id,
  className = 'w-4 h-4',
  size,
  brandColor = true,
}) => {
  const norm = id.toLowerCase()
  const style = size ? { width: size, height: size } : undefined
  const asset =
    norm.includes('claude') || norm.includes('anthropic')
      ? claudeAsset
      : norm.includes('codex') ||
          norm.includes('chatgpt') ||
          norm.includes('openai') ||
          norm === 'api'
        ? chatgptAsset
        : norm.includes('deepseek')
          ? deepseekAsset
          : norm.includes('opencode')
            ? opencodeAsset
            : norm.includes('gemini') || norm.includes('google')
              ? geminiAsset
              : norm.includes('kimi') || norm.includes('moonshot')
                ? kimiAsset
                : norm.includes('grok') || norm.includes('xai')
                  ? grokAsset
                  : norm.includes('ollama')
                    ? ollamaAsset
                    : null

  if (
    asset &&
    (asset === chatgptAsset ||
      asset === grokAsset ||
      norm.includes('opencode') ||
      norm.includes('ollama'))
  ) {
    return (
      <span
        className={`${className} inline-block bg-current`}
        style={{
          ...style,
          maskImage: `url(${asset})`,
          WebkitMaskImage: `url(${asset})`,
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
        }}
        aria-hidden="true"
      />
    )
  }

  if (asset) {
    return <img src={asset} alt="" className={className} style={style} aria-hidden="true" />
  }

  // 1. Claude: orange Claude starburst
  if (norm.includes('claude') || norm.includes('anthropic')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${brandColor ? 'text-[#DA7756]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        {/* Crisp 8-point geometric starburst */}
        <path d="M12 1.5l2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4 2.4-6.6z" />
        <path
          d="M17.5 4.5l-1.2 3.8 3.8-1.2-2.6-2.6zM6.5 4.5l2.6 2.6 3.8 1.2-1.2-3.8zM17.5 19.5l2.6-2.6-3.8-1.2 1.2 3.8zM6.5 19.5l-1.2-3.8-3.8 1.2 2.6 2.6z"
          opacity="0.6"
        />
      </svg>
    )
  }

  // 2. ChatGPT / Codex: the iconic 6-lobed spiral knot
  if (
    norm.includes('codex') ||
    norm.includes('chatgpt') ||
    norm.includes('openai') ||
    norm.includes('gpt')
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} ${brandColor ? 'text-[#10A37F]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <path d="M19.1 13.5a4.2 4.2 0 0 0 .4-1.8 4.2 4.2 0 0 0-3.6-4.2V6.3a4.2 4.2 0 0 0-4.9-3.7 4.2 4.2 0 0 0-3.1 2.3 4.2 4.2 0 0 0-3.7 2.1 4.2 4.2 0 0 0-.4 4.3 4.2 4.2 0 0 0-2.4 3.7 4.2 4.2 0 0 0 2.4 3.8v1.2a4.2 4.2 0 0 0 4.9 3.7 4.2 4.2 0 0 0 3.1-2.3 4.2 4.2 0 0 0 3.7-2.1 4.2 4.2 0 0 0 .4-4.3 4.2 4.2 0 0 0 2.8-1.6z" />
        <path d="M12 8.5v7M8.5 10l7 4M8.5 14l7-4" opacity="0.8" />
      </svg>
    )
  }

  // 3. DeepSeek: the blue whale
  if (norm.includes('deepseek')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${brandColor ? 'text-[#0284C7]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        {/* DeepSeek whale silhouette with blowhole spout */}
        <path d="M3.5 14.5c.8-3.6 4-6.5 8.2-6.5 4.8 0 7.8 2.8 7.8 5.8 0 1.9-1.2 3.4-3.2 4.2-1.5.6-3.8.8-6.2.2-2.5-.6-4.9-.3-6.6 1.8-.4-.4-.8-1.2-1-2.1-.5-1.5-.4-2.6 1-3.4z" />
        <circle cx="8" cy="11.5" r="1" fill="#ffffff" />
        <path
          d="M12 4.5c-.3 1-.8 1.6-1.5 2M13.5 3.5c-.2 1.3-.4 2.2-1 3M15 4.5c.3 1 .8 1.6 1.5 2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    )
  }

  // 4. OpenCode: the OpenCode geometric mark
  if (norm.includes('opencode')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} ${brandColor ? 'text-[#06B6D4]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <polygon
          points="12 2 21 7.5 21 16.5 12 22 3 16.5 3 7.5 12 2"
          fill="none"
          strokeWidth="1.7"
        />
        <polyline points="8 10 5.5 12 8 14" />
        <polyline points="16 10 18.5 12 16 14" />
        <line x1="10.5" y1="15" x2="13.5" y2="9" />
      </svg>
    )
  }

  // 5. Gemini: the four-point gradient sparkle
  if (norm.includes('gemini') || norm.includes('google')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${brandColor ? 'text-[#4E82EE]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" />
      </svg>
    )
  }

  // 6. Kimi: Moonshot Kimi mark
  if (norm.includes('kimi') || norm.includes('moonshot')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${brandColor ? 'text-[#6366F1]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <path d="M6 4h3v6.5l5.5-6.5h4L12.5 11l6.5 9h-4l-6-8.5V20H6V4z" />
      </svg>
    )
  }

  // 7. GLM: Zhipu GLM mark
  if (norm.includes('glm') || norm.includes('zhipu')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${brandColor ? 'text-[#2563EB]' : ''}`}
        style={style}
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="3.5" />
        <circle cx="16" cy="8" r="3.5" opacity="0.7" />
        <circle cx="12" cy="16" r="4" />
        <path d="M8 8l4 8M16 8l-4 8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }

  // Fallback product chip
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  )
}
