import { expect, it, vi } from 'vitest'
import { runSequentially } from '../scripts/run-sequentially.mjs'

it('waits for each fixture operation before starting the next', async () => {
  const started: number[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const result = runSequentially([1, 2], async (value: number) => {
    started.push(value)
    if (value === 1) await gate
  })
  await Promise.resolve()
  expect(started).toEqual([1])
  release()
  await result
  expect(started).toEqual([1, 2])
})
it('stops the check chain on its first failure', async () => {
  const failure = new Error('fixture failed')
  const operation = vi.fn(() => Promise.reject(failure))
  await expect(runSequentially([1, 2], operation)).rejects.toBe(failure)
  expect(operation).toHaveBeenCalledTimes(1)
})
