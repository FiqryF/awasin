export const timedAuthFetch: typeof fetch = (input, init) => {
  const original = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const timeout = AbortSignal.timeout(15_000)
  return fetch(input, {...init, signal: original ? AbortSignal.any([original, timeout]) : timeout})
}
