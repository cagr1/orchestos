import { Copy, Paperclip, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Banner,
  BannerAction,
  BannerActions,
  BannerDescription,
  BannerTitle,
} from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChatMessage } from '@/components/ui/chat-message'
import { InputMessage } from '@/components/ui/input-message'
import { ThinkingIndicator } from '@/components/ui/thinking-indicator'
import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps'
import { TooltipProvider } from '@/components/ui/tooltip'

function makeImage(name: string, hue: number): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 120
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = `hsl(${hue} 40% 55%)`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob ?? new Blob()], name, { type: 'image/png' })),
      'image/png',
    )
  })
}

function useSampleImages(): File[] {
  const [files, setFiles] = useState<File[]>([])
  useEffect(() => {
    let alive = true
    void Promise.all([
      makeImage('captura-dashboard.png', 210),
      makeImage('check-fallido.png', 12),
    ]).then((made) => alive && setFiles(made))
    return () => {
      alive = false
    }
  }, [])
  return files
}

function State({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section data-testid={`state-${id}`} className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      {children}
    </section>
  )
}

const copyAction = (
  <Button variant="ghost" size="compact" aria-label="Copy message" leadingIcon={Copy}>
    {null}
  </Button>
)

const composerLeft = ({ openFilePicker }: { openFilePicker: (accept?: string) => void }) => (
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="compact"
      aria-label="Attach file"
      leadingIcon={Paperclip}
      onClick={() => openFilePicker()}
    >
      {null}
    </Button>
    <Button variant="ghost" size="compact">
      Sonnet 5.5
    </Button>
  </div>
)

export default function ThreadStatesSheet() {
  const images = useSampleImages()
  const [empty, setEmpty] = useState('')
  const [filled, setFilled] = useState('Find out why the lint check failed in task 12')
  const [attached, setAttached] = useState<File[]>([])
  const shownAttached = attached.length > 0 ? attached : images.slice(0, 1)

  return (
    <TooltipProvider>
      <div
        data-ff
        data-testid="thread-states-sheet"
        className="min-h-screen bg-background px-6 py-10 text-foreground"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-10">
          <header className="flex flex-col gap-1">
            <h1 className="text-title">Thread states</h1>
            <p className="text-caption text-muted-foreground">
              Development sheet for the Fluid Functionalism family.
            </p>
          </header>

          <State id="message-user" label="User message">
            <ChatMessage from="user" time="Today 10:42" actions={copyAction}>
              Create a task to migrate login to OAuth.
            </ChatMessage>
          </State>

          <State id="message-assistant" label="Assistant response">
            <ChatMessage from="assistant" actions={copyAction}>
              <p>Done: I created the “Migrate login to OAuth” task and left it pending.</p>
              <p>The type check passed; integration tests still need to run before closing it.</p>
            </ChatMessage>
          </State>

          <State id="message-attachments" label="Message with attachments">
            <ChatMessage from="user" time="Today 10:44" files={images} actions={copyAction}>
              This is the error I see on the dashboard after the latest commit.
            </ChatMessage>
          </State>

          <State id="message-pdf" label="PDF attachment">
            <ChatMessage
              from="user"
              files={[new File(['sample PDF'], 'spec.pdf', { type: 'application/pdf' })]}
            >
              Review the attached specification.
            </ChatMessage>
          </State>

          <State id="thinking" label="Thinking">
            <ThinkingIndicator />
          </State>

          <State id="thinking-steps-running" label="Steps in progress">
            <ThinkingSteps defaultOpen>
              <ThinkingStepsHeader>Thinking</ThinkingStepsHeader>
              <ThinkingStepsContent>
                <ThinkingStep label="Read the project plan" status="complete" />
                <ThinkingStep label="Find the failed check" status="complete">
                  <ThinkingStepDetails
                    summary="2 files reviewed"
                    details={['src/run/checks.ts', 'scripts/pre-commit.sh']}
                  />
                </ThinkingStep>
                <ThinkingStep label="Write the fix" status="active" isLast />
              </ThinkingStepsContent>
            </ThinkingSteps>
          </State>

          <State id="thinking-steps-done" label="Completed steps">
            <ThinkingSteps defaultOpen={false}>
              <ThinkingStepsHeader>Thought for 8 s</ThinkingStepsHeader>
              <ThinkingStepsContent>
                <ThinkingStep label="Read the project plan" status="complete" />
                <ThinkingStep label="Find the failed check" status="complete" />
                <ThinkingStep label="Write the fix" status="complete" isLast />
              </ThinkingStepsContent>
            </ThinkingSteps>
          </State>

          <State id="composer-empty" label="Empty composer">
            <InputMessage
              value={empty}
              onValueChange={setEmpty}
              placeholder="Ask for a task or ask a question…"
              leftSlot={composerLeft}
            />
          </State>

          <State id="composer-with-files" label="Composer with text and attachment">
            <InputMessage
              value={filled}
              onValueChange={setFilled}
              files={shownAttached}
              onFilesChange={setAttached}
              leftSlot={composerLeft}
            />
          </State>

          <State id="card" label="Card">
            <Card>
              <CardHeader>
                <CardTitle>Migrate login to OAuth</CardTitle>
                <CardDescription>
                  The lint check failed; the task is waiting for a fix.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge color="red">Check failed</Badge>
              </CardContent>
              <CardFooter>
                <Button variant="primary" leadingIcon={Plus}>
                  Create task
                </Button>
                <Button variant="secondary">Retry</Button>
              </CardFooter>
            </Card>
          </State>

          <State id="badges" label="Badges">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="gray">Pending</Badge>
              <Badge color="green">Complete</Badge>
              <Badge color="amber">In review</Badge>
              <Badge color="red">Failed</Badge>
              <Badge color="gray" variant="dot">
                Pending
              </Badge>
              <Badge color="green" variant="dot">
                Complete
              </Badge>
              <Badge color="amber" variant="dot">
                In review
              </Badge>
              <Badge color="red" variant="dot">
                Failed
              </Badge>
            </div>
          </State>

          <State id="banner" label="Banners">
            <div className="flex flex-col gap-3">
              <Banner status="info">
                <BannerTitle>Task queued</BannerTitle>
                <BannerDescription>It starts when the current run finishes.</BannerDescription>
              </Banner>
              <Banner status="warning">
                <BannerTitle>Dirty working tree</BannerTitle>
                <BannerDescription>There are uncommitted changes in the project.</BannerDescription>
                <BannerActions>
                  <BannerAction>Commit and run</BannerAction>
                </BannerActions>
              </Banner>
              <Banner status="error">
                <BannerTitle>Check failed</BannerTitle>
                <BannerDescription>Lint finished with 3 errors.</BannerDescription>
                <BannerActions>
                  <BannerAction>Retry</BannerAction>
                </BannerActions>
              </Banner>
            </div>
          </State>
        </div>
      </div>
    </TooltipProvider>
  )
}
