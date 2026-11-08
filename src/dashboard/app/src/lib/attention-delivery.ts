import type { AttentionEvent } from './attention-events'

let audio: AudioContext | undefined

export function playAttentionSound(type: AttentionEvent['type']) {
  try {
    audio ??= new AudioContext()
    const context = audio
    void context
      .resume()
      .then(() => {
        const start = context.currentTime
        const count = type === 'needsInput' ? 2 : 1
        for (let i = 0; i < count; i++) {
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          oscillator.frequency.value = type === 'needsInput' ? 740 : 520
          gain.gain.setValueAtTime(0.04, start + i * 0.19)
          gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.19 + 0.15)
          oscillator.connect(gain)
          gain.connect(context.destination)
          oscillator.start(start + i * 0.19)
          oscillator.stop(start + i * 0.19 + 0.15)
          oscillator.onended = () => {
            oscillator.disconnect()
            gain.disconnect()
          }
        }
      })
      .catch(() => undefined)
  } catch {
    // Unsupported or unavailable audio must not interrupt a turn.
  }
}

export function deliverAttention(event: AttentionEvent, sound: boolean, open: () => void) {
  if (sound) playAttentionSound(event.type)
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const notification = new Notification(event.title, { body: event.body, tag: event.threadId })
    notification.onclick = () => {
      window.focus()
      open()
      notification.close()
    }
  } catch {
    // The browser can refuse system notifications independently of sound.
  }
}
