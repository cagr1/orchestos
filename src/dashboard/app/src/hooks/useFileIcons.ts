import { useEffect, useState } from 'react'
import type { Manifest } from '../lib/file-icons'

let manifestRequest: Promise<Manifest | null> | undefined

export function useFileIcons(): Manifest | null {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  useEffect(() => {
    let disposed = false
    manifestRequest ??= fetch('/app/dist/file-icons/manifest.json')
      .then((response) => {
        if (!response.ok) throw new Error(`File icons: HTTP ${response.status}`)
        return response.json() as Promise<Manifest>
      })
      .catch(() => null)
    void manifestRequest.then((result) => {
      if (!disposed) setManifest(result)
    })
    return () => {
      disposed = true
    }
  }, [])
  return manifest
}
