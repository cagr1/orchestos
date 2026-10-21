import { Check } from 'lucide-react'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { defaultRemarkPlugins, Streamdown } from 'streamdown'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

const REMARK_PLUGINS = [...Object.values(defaultRemarkPlugins), remarkGfm, remarkBreaks]

const CLASS_NAME =
  'prose prose-invert max-w-none w-full whitespace-normal [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_:not(pre)>code]:bg-app-bg [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-control [&_:not(pre)>code]:border [&_:not(pre)>code]:border-app [&_:not(pre)>code]:font-mono [&_strong]:font-bold [&_strong]:text-app [&_[data-streamdown=code-block]]:!block [&_[data-streamdown=code-block]]:!w-full [&_[data-streamdown=code-block]]:!border [&_[data-streamdown=code-block]]:!border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)] [&_[data-streamdown=code-block]]:!rounded-control [&_[data-streamdown=code-block]]:!bg-app-bg [&_[data-streamdown=code-block]]:!p-0 [&_[data-streamdown=code-block-header]]:!flex [&_[data-streamdown=code-block-header]]:!items-center [&_[data-streamdown=code-block-header]]:!px-2.5 [&_[data-streamdown=code-block-header]>*]:!ml-0 [&_[data-streamdown=code-block-body]]:!border-0 [&_[data-streamdown=code-block-body]]:!rounded-none [&_[data-streamdown=code-block-body]]:!bg-transparent [&_[data-streamdown=code-block-body]]:!px-2.5 [&_[data-streamdown=code-block-actions]]:!-translate-y-2 [&_[data-streamdown=code-block-actions]]:!flex [&_[data-streamdown=code-block-actions]]:!items-center [&_[data-streamdown=code-block-actions]]:!border-0 [&_[data-streamdown=code-block-actions]]:!rounded-none [&_[data-streamdown=code-block-actions]]:!bg-transparent [&_[data-streamdown=code-block-actions]]:!px-2.5'

const COMPONENTS = {
  input: ({ checked, type }: { checked?: boolean; type?: string }) => {
    if (type === 'checkbox') {
      return (
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 mr-1.5 align-middle rounded-[3px] border border-app bg-app-elevated text-app-accent">
          {checked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : null}
        </span>
      )
    }
    return <input type={type} defaultChecked={checked} readOnly />
  },
}

export function ThreadMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  const reduced = usePrefersReducedMotion()
  return (
    <div className={CLASS_NAME}>
      <Streamdown
        mode="streaming"
        animated={!reduced}
        isAnimating={streaming}
        parseIncompleteMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
        controls={{ code: { copy: true, download: false }, table: false, mermaid: false }}
        lineNumbers={false}
      >
        {text}
      </Streamdown>
    </div>
  )
}
