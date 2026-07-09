/**
 * src/chat/ocr.ts
 *
 * Mes 19, Bloque C — OCR de imágenes del chat cuando el modelo elegido no
 * soporta visión (ver docs/ocr-chat-design.md). Motor: tesseract.js
 * (Apache-2.0, wrapper WASM de Tesseract) — corre en el mismo proceso Bun,
 * sin GPU/Python/cuenta externa (decisión A.2, Baidu Cloud descartado por
 * Carlos por fricción de registro).
 *
 * Un solo worker se crea una vez y se reusa entre requests — crear uno por
 * mensaje sería el costo de arranque (carga del modelo WASM) en cada llamada.
 */
import { createWorker, type Worker } from 'tesseract.js'

// tesseract.js descarga `eng.traineddata`/`spa.traineddata` (~8.5MB) al cwd
// del proceso la primera vez que se usa cada idioma, y los reusa después —
// mismo patrón que `node_modules` (dependencia de runtime, no del repo).
// Intentar redirigir `langPath`/`cachePath` a `~/.orchestos/cache/` rompió la
// descarga automática en tesseract.js@7 (`ENOENT ...eng.traineddata.gz`,
// probado en vivo) — se deja el default de la librería, y los `.traineddata`
// quedan en `.gitignore`.
let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) workerPromise = createWorker(['eng', 'spa'])
  return workerPromise
}

/**
 * Extrae texto de una imagen (data URL base64, mismo formato que ya usa
 * `FileEntry.content` para adjuntos de tipo imagen). Lanza si el worker o el
 * reconocimiento fallan — el caller decide qué hacer (nunca degradar en
 * silencio, mismo principio que el 422 de J.2/Mes 18).
 */
export async function extractTextFromImage(dataUrl: string): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(dataUrl)
  return data.text.trim()
}
