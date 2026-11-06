import { expect, test } from 'bun:test'
import { createApprovalAnswers } from './approvalAnswers'

test('one POST while sending and after success until the request disappears, per approval id', async () => {
  let finish!: () => void
  let posts = 0
  const answers = createApprovalAnswers(
    async () => {
      posts++
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    },
    () => {},
  )
  answers.sync(['a', 'b'])
  const first = answers.submit('a', 'approve')
  expect(answers.disabled('a')).toBe(true)
  expect(answers.disabled('b')).toBe(false)
  await answers.submit('a', 'reject')
  expect(posts).toBe(1)
  finish()
  await first
  answers.sync(['b', 'a']) // A stale/reordered poll still includes the answered request.
  await answers.submit('a', 'approve-always')
  expect(posts).toBe(1)
  expect(answers.disabled('a')).toBe(true)
  answers.sync(['b'])
  await answers.submit('a', 'approve')
  expect(posts).toBe(1)
})

test('POST failure allows retry; error clears when requests change or running ends', async () => {
  let fail = true
  const answers = createApprovalAnswers(
    async () => {
      if (fail) throw new Error('POST failed')
    },
    () => {},
  )
  answers.sync(['a'])
  await answers.submit('a', 'reject')
  expect(answers.error).toBe('POST failed')
  expect(answers.disabled('a')).toBe(false)
  answers.sync(['a'])
  expect(answers.error).toBe('POST failed')
  answers.sync(['a', 'b'])
  expect(answers.error).toBe('')
  await answers.submit('a', 'approve')
  answers.sync([]) // TaskCard supplies no requests outside running.
  expect(answers.error).toBe('')
  expect(answers.disabled('a')).toBe(true)
  answers.sync(['a'])
  fail = false
  await answers.submit('a', 'approve')
  expect(answers.error).toBe('')
  expect(answers.disabled('a')).toBe(true)
})

test('an error arriving after its request disappeared cannot leak into the next set', async () => {
  let fail!: (error: Error) => void
  const answers = createApprovalAnswers(
    () =>
      new Promise<void>((_, reject) => {
        fail = reject
      }),
    () => {},
  )
  answers.sync(['a'])
  const sending = answers.submit('a', 'approve')
  answers.sync(['b'])
  fail(new Error('obsolete'))
  await sending
  expect(answers.error).toBe('')
  expect(answers.disabled('b')).toBe(false)
})
