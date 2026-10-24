/** Result rows have no server IDs. Keep content-based keys stable, including duplicates. */
export function keyedItems<T>(items: readonly T[]) {
  const occurrences = new Map<string, number>()
  return items.map(value => {
    const content = JSON.stringify(value)
    const occurrence = occurrences.get(content) ?? 0
    occurrences.set(content, occurrence + 1)
    return { key: `${content}:${occurrence}`, value }
  })
}
