# UI.14 — Prompt único para Google AI Studio

Pegar en el mismo proyecto de AI Studio de `orchestos-ai-agent-dashboard`. Unifica el prompt 1 (Dev como chat
que actúa como CLI + medidor de contexto) y las correcciones de Carlos del 2026-09-22 (gráfico antes que texto,
logos de producto). Al terminar, la plantilla se copia tal cual a `src/dashboard/app/` (regla UI.13).

---

You are a senior product designer + frontend engineer. Bring this app to the level of Linear, the Claude Code
desktop app and the ChatGPT Codex app: calm, dense but breathable, precise alignment, one accent color, subtle
borders instead of heavy boxes, restrained motion. Keep the design tokens, the four themes, fonts, the sidebar
structure, the inspector tabs and lucide-react. No new dependencies. All UI text in English.

## Rule 1 — show, don't tell

Users read a UI through shape, color, position and icons. Delete every word that restates what an element
already shows; a remaining label must carry information the user cannot see otherwise. Names and details go in
tooltips. Status is a colored dot or icon, not a sentence. Numbers appear only when they are not obvious.
Apply this everywhere, not only in the places listed below.

## Rule 2 — product logos, not company logos

Every CLI / model provider is shown with its **product** logo, never the company mark (no Anthropic "A\", no
generic OpenAI wordmark): **Claude** = the orange Claude starburst; **ChatGPT / Codex** = the ChatGPT knot;
**DeepSeek** = the blue whale; **OpenCode** = the OpenCode mark; **Gemini** = the four-point gradient sparkle;
**Kimi**, **GLM** = their product marks. Inline SVGs in `ProviderLogos`, in their brand colors, crisp at 14px and
18px, one component used everywhere (sidebar agents, session header, composer, status bar, history, runs).

## 1. Dev mode: an agent conversation that works like a coding CLI

Replace the terminal-style console with an agent conversation: reads like a chat, but every turn shows what the
agent did inside the project folder.

- **Session header (40px)**: title; CLI product logo before it (tooltip = name); a small status dot next to the
  title (amber pulsing = waiting for approval, accent spinner = working, green = done, red = failed; tooltip =
  state); Archive and Stop as icon buttons; the **context ring** (section 3) on the right. No path pill (the top
  header already shows `project / branch`), no CLI name text, no status text.
- **Timeline**, centered, same max width as Chat:
  - user message: no avatar, no "You" label; time only on hover;
  - "Thought · 6s", collapsed; the summary shows only when expanded;
  - **tool rows** are flat (no card borders), 32px, muted icon + verb + target, subtle hover background,
    expandable: `Read`, `Edit src/run/router.ts +12 −3`, `Bash bun test src/run`, `Search "contextWindow" 3`;
    consecutive reads collapse into **one** row "Read 3 files"; no "72 lines"-style metadata; the match count
    is a plain muted number; exit codes are a small red ✕ / green ✓ icon, never an `EXIT 1` badge;
  - expanded Edit → inline colored diff; expanded Bash → mono output, max height, scroll, copy icon;
  - **approval card**: command or path, one-line reason, Approve / Deny; the only element with an accent
    border in the turn;
  - final answer in markdown; while running, one live row with a subtle shimmer, current step and elapsed time.
- Empty state (no session selected): keep "OrchestOS Dev".

## 2. Composer (Chat and Dev share it)

- Placeholder: "Message Claude…" with the active CLI's name. No `/` or `!` buttons: typing `/` opens the command
  menu, typing `!` switches to shell mode and shows a small mono chip inside the input.
- CLI selector: product logos only, active one highlighted, tooltip = name. No text.
- Model and effort merged into **one** compact dropdown `Sonnet 3.7 · High ▾`; open → models on the left, effort
  as a 4-step vertical slider on the right.
- **Nothing under the composer**: no status line (model, context, branch, elapsed, hints). Each lives elsewhere.

## 3. Context ring (Chat and Dev)

Chat gets the same session header as Dev (title, CLI logo, context ring). The ring is an 18px circular gauge
that fills with the percent of the context window used: no number under 50%, a short mono `62%` from 50%,
warning color from 80%, error color from 95%. Hover/focus → popover with model, `used / window` tokens,
percent, and at 80%+ one line: "Start a new session or compact". No data → no ring (never a fake number).

## 4. Usage: bottom status bar only

- **Delete the "CLI QUOTAS" block from the left sidebar.** The sidebar footer is just Settings.
- Bottom bar, per installed CLI: product logo + thin bar + percent of its **5-hour quota** remaining. No text
  labels, no context, no model.
- Click a CLI → floating panel above the bar (not clipped by it): CLI logo + name, the **5-hour** and **weekly**
  quotas, each with percent, thin bar and reset time ("resets 4:30 PM", "resets Mon"). Closes on outside click
  and Escape.

## 5. Right inspector and details

- "Names / Contents" becomes a small icon toggle inside the search field (`Aa` / `{}` with tooltips).
- File preview: breadcrumb + ✕ icon instead of path + "Close".
- Remove the "Preview" tag under the app logo.

Mock data: one Dev session with a collapsed thought, a "Read 3 files" row, a Search, an Edit with a diff, a
failing Bash then a passing one, a pending approval card and a final summary; context ring at 64% in Dev and 23%
in Chat; status bar with Claude, Codex, OpenCode, DeepSeek and Gemini, one of them without quota data (bar empty,
`—`).
