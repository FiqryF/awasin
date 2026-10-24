/** Shared DB roles and SSR fixtures require ordered, fail-fast execution. */
export function runSequentially(items, operation) {
  return items.reduce((previous, item) => previous.then(() => operation(item)), Promise.resolve())
}
