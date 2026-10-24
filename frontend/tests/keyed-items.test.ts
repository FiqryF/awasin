import { expect, it } from 'vitest'
import { keyedItems } from '../src/features/history/keyedItems'

it('keeps result row keys stable on reorder and distinguishes duplicate content', () => {
  const first = { title: 'First', description: 'Finding' }
  const second = { title: 'Second', description: 'Finding' }
  const original = keyedItems([first, second, first])
  const reordered = keyedItems([second, first, first])
  expect(new Set(original.map(item => item.key)).size).toBe(3)
  expect(original[0].key).toBe(reordered[1].key)
  expect(original[1].key).toBe(reordered[0].key)
  expect(original[2].key).toBe(reordered[2].key)
})
