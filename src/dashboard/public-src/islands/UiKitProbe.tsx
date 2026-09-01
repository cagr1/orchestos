/**
 * Banco de pruebas del design system (UI.2, Mes 30). Se monta SOLO con `?ui-probe=1`:
 * el dashboard normal no lo ve nunca.
 *
 * Por qué existe, y por qué no es "una demo linda": la regla cero del proyecto dice que
 * nada se entrega sin verificar en vivo que hace lo que dice. `Toast` y `Combobox` ya
 * tienen consumidor real (los 71 `showToast()` y los 5 combos de modelo), así que se
 * verifican solos. `Button`, `Input`, `Tabs` y `Dialog` NO tienen consumidor todavía —
 * su adopción real ocurre en UI.3 (shell) y UI.4 (pantallas). Sin este banco serían
 * cuatro archivos que compilan y que nadie probó: exactamente el "contenido muerto" que
 * el proyecto ya se comió una vez con los campos de skill que nunca llegaban al prompt.
 *
 * El gate `scripts/ui-gates/ui2-design-system.mjs` ejercita esta pantalla y mide contra
 * los valores del CSS vanilla, para que "espeja el look vanilla" sea una afirmación
 * verificable y no una opinión.
 */
import { useState } from 'react'
import { Button } from '../components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx'
import { Input } from '../components/ui/input.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { pushToast } from '../lib/toast-store.ts'

const VARIANTS = ['default', 'secondary', 'ghost', 'destructive', 'success'] as const

export function UiKitProbe() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [text, setText] = useState('')

  return (
    <div className="mb-3 rounded-md border border-border bg-card p-4 font-sans text-foreground">
      <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        UI.2 design system probe
      </div>

      <Tabs defaultValue="buttons">
        <TabsList>
          <TabsTrigger value="buttons">Buttons</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="overlays">Overlays</TabsTrigger>
        </TabsList>

        <TabsContent value="buttons">
          <div className="flex flex-wrap items-center gap-2" data-probe="buttons">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} data-variant={variant}>
                {variant}
              </Button>
            ))}
            <Button size="sm" variant="secondary" data-probe="btn-sm">
              small
            </Button>
            <Button disabled data-probe="btn-disabled">
              disabled
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="inputs">
          <div className="flex max-w-[420px] flex-col gap-2" data-probe="inputs">
            <Input
              placeholder="Escribí algo…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-probe="input"
            />
            <span className="text-xs text-muted-foreground">valor: {text || '—'}</span>
          </div>
        </TabsContent>

        <TabsContent value="overlays">
          <div className="flex flex-wrap gap-2" data-probe="overlays">
            <Button
              variant="secondary"
              onClick={() => pushToast('Toast de prueba')}
              data-probe="toast"
            >
              Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => pushToast('Algo falló', 'error')}
              data-probe="toast-error"
            >
              Toast error
            </Button>
            <Button onClick={() => setDialogOpen(true)} data-probe="open-dialog">
              Abrir dialog
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent data-probe="dialog">
              <DialogHeader>
                <DialogTitle>Dialog de prueba</DialogTitle>
              </DialogHeader>
              <div className="px-[18px] py-4 text-[13px]">
                Espeja el modal vanilla: 440px de ancho, radio 12px, scrim con blur.
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost" data-probe="dialog-cancel">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button data-probe="dialog-ok" onClick={() => setDialogOpen(false)}>
                  Aceptar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
