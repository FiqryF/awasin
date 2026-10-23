import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), onAuthStateChange: vi.fn(), verifyOtp: vi.fn() }))
vi.mock('../src/features/auth/client', () => ({ requireSupabase: () => ({ auth: mock }) }))
let event: (event: string) => void
beforeEach(() => {
  vi.resetModules()
  window.history.replaceState(null, '', '/reset-password?code=local-code')
  mock.onAuthStateChange.mockImplementation((callback) => { event = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  mock.exchangeCodeForSession.mockImplementation(async () => {
    event('PASSWORD_RECOVERY')
    return { data: { session: { access_token: crypto.randomUUID() }, user: { email_confirmed_at: '2026-01-01' } }, error: null }
  })
})

it('exchanges PKCE only once across remounts and clears URL before exchange', async () => {
  const { completeCallback } = await import('../src/features/auth/callback')
  const first = completeCallback()
  const second = completeCallback()
  expect(first).toBe(second)
  expect(window.location.search).toBe('')
  expect(await first).toBe('recovery')
  expect(mock.exchangeCodeForSession).toHaveBeenCalledTimes(1)
})

it('does not treat a normal confirmation code as a recovery session', async () => {
  mock.exchangeCodeForSession.mockImplementation(async () => {
    event('SIGNED_IN')
    return { data: { session: {}, user: { email_confirmed_at: '2026-01-01' } }, error: null }
  })
  const { completeCallback } = await import('../src/features/auth/callback')
  expect(await completeCallback()).toBe('signup')
})

it.each(['/reset-password', '/reset-password#error=denied', '/reset-password#access_token=not-accepted', '/reset-password?error=expired'])('rejects invalid callback %s', async (path) => {
  window.history.replaceState(null, '', path)
  const { completeCallback } = await import('../src/features/auth/callback')
  await expect(completeCallback()).rejects.toThrow()
  expect(window.location.search + window.location.hash).toBe('')
  expect(mock.exchangeCodeForSession).not.toHaveBeenCalled()
})

it('handles expired or cross-browser PKCE codes without exposing provider details', async () => {
  mock.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: 'private provider detail' } })
  const { completeCallback } = await import('../src/features/auth/callback')
  await expect(completeCallback()).rejects.toThrow('browser yang sama')
})

it.each(['invite', 'recovery'])('supports provider-verified %s hashes on the password-setup route', async (type) => {
  window.history.replaceState(null, '', `/reset-password?token_hash=local-invite&type=${type}`)
  mock.verifyOtp.mockResolvedValue({ data: { session: {}, user: { email_confirmed_at: '2026-01-01' } }, error: null })
  const { completeCallback } = await import('../src/features/auth/callback')
  expect(await completeCallback()).toBe(type)
  expect(mock.verifyOtp).toHaveBeenCalledWith({ token_hash: 'local-invite', type })
  expect(window.location.search).toBe('')
})

it('rejects an attacker-selected OTP type', async () => {
  window.history.replaceState(null, '', '/reset-password?token_hash=local-invite&type=email_change')
  const { completeCallback } = await import('../src/features/auth/callback')
  await expect(completeCallback()).rejects.toThrow('tidak diizinkan')
  expect(mock.verifyOtp).not.toHaveBeenCalled()
})

it('verifies manual recovery codes with the provider and rejects missing sessions', async () => {
  const { verifyRecoveryCode } = await import('../src/features/auth/callback')
  await expect(verifyRecoveryCode('bad', '123456')).rejects.toThrow()
  expect(mock.verifyOtp).not.toHaveBeenCalled()
  mock.verifyOtp.mockResolvedValue({ data: { session: {}, user: { email_confirmed_at: '2026-01-01' } }, error: null })
  await verifyRecoveryCode('test@example.invalid', '123456')
  expect(mock.verifyOtp).toHaveBeenCalledWith({ email: 'test@example.invalid', token: '123456', type: 'recovery' })
  mock.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired' } })
  await expect(verifyRecoveryCode('test@example.invalid', '123456')).rejects.toThrow('Kode tidak valid')
})
