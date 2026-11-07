import { useEffect, useRef, useState } from 'react'

type Profile = { codes: boolean | null }
const profileChanged = 'orchestos-profile-changed'

async function requestProfile(codes?: boolean): Promise<Profile> {
  const response = await fetch(
    '/api/profile',
    codes === undefined
      ? undefined
      : {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes }),
        },
  )
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

export function useUserProfile() {
  const [codes, setCodes] = useState<boolean | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  useEffect(() => {
    let disposed = false
    let changed = false
    const update = (event: Event) => {
      changed = true
      setCodes((event as CustomEvent<Profile>).detail.codes)
      setError(null)
    }
    window.addEventListener(profileChanged, update)
    void requestProfile()
      .then((profile) => {
        if (!disposed && !changed) setCodes(profile.codes)
      })
      .catch((reason: Error) => {
        if (!disposed && !changed) setError(reason.message)
      })
    return () => {
      disposed = true
      window.removeEventListener(profileChanged, update)
    }
  }, [])
  const save = async (value: boolean) => {
    if (saveLock.current) return
    saveLock.current = true
    setSaving(true)
    setError(null)
    try {
      const profile = await requestProfile(value)
      setCodes(profile.codes)
      window.dispatchEvent(new CustomEvent(profileChanged, { detail: profile }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }
  return { codes, save, saving, error }
}
