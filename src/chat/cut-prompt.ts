export function cutPrompt({ hasNextMd }: { hasNextMd: boolean }): string {
  return [
    "Wrap up this session under the project's own rules (AGENTS.md, CLAUDE.md and plan).",
    'Do not create tasks in this turn. Perform the wrap-up yourself: edit the existing NEXT.md, commit and push as allowed below.',
    '1. Item in progress: close it if its checks pass under those rules. Otherwise leave it open and say exactly where it stopped and what is missing.',
    hasNextMd
      ? '2. Handoff: rewrite NEXT.md as one present, not a log: what closed (with SHAs), what comes next and in what order, new traps, decisions pending; drop lines no longer true.'
      : '2. Handoff: do not create NEXT.md; write the handoff as your final reply under a ## Handoff heading: what closed (with SHAs), what comes next and in what order, new traps, decisions pending; drop lines no longer true.',
    "3. Commit by explicit paths (never the whole index); push if the project's rules allow it, in the foreground.",
    '4. Do not release locks or close the session: OrchestOS checks the result.',
  ].join('\n\n')
}
