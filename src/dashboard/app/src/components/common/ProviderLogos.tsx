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
          norm.includes('gpt')
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

  // GLM: Zhipu GLM mark
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
