import type React from 'react'

export interface ProviderLogoProps {
  id: 'claude' | 'openai' | 'codex' | 'gemini' | 'deepseek' | 'opencode' | string
  className?: string
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({ id, className = 'w-4 h-4' }) => {
  const norm = id.toLowerCase()

  if (norm.includes('claude') || norm.includes('anthropic')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
      </svg>
    )
  }

  if (
    norm.includes('openai') ||
    norm.includes('chatgpt') ||
    norm.includes('codex') ||
    norm.includes('gpt')
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M12 3.2a4.3 4.3 0 0 1 4.1 3 4.3 4.3 0 0 1 4.5 4.8 4.3 4.3 0 0 1-2 7.3 4.3 4.3 0 0 1-6.6 3.4 4.3 4.3 0 0 1-6.2-3.9 4.3 4.3 0 0 1-2.2-7.2 4.3 4.3 0 0 1 4.3-4.5A4.3 4.3 0 0 1 12 3.2Z" />
        <path d="M8.1 8.4 15.9 4.8M5.9 15.8l.2-8.5M12 20.4l-7.4-4.3M18.2 15.7l-7.5 4.4M18.1 8.4l-7.6 4.3M6 8.5l7.5 4.2" />
      </svg>
    )
  }

  if (norm.includes('gemini') || norm.includes('google')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 1.5 14.65 9.35 22.5 12l-7.85 2.65L12 22.5l-2.65-7.85L1.5 12l7.85-2.65L12 1.5Z" />
      </svg>
    )
  }

  if (norm.includes('deepseek')) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M4 14c2-4 6-8 11-8 4 0 5 3 5 6-3 0-5 2-8 3-2 1-5 2-8-1z" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
        <path d="M14 15c-1 3-3 5-6 5" />
      </svg>
    )
  }

  if (norm.includes('opencode')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M22 24H2V0h20zM17 4.8H7v14.4h10z" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  )
}
