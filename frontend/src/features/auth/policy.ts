export function passwordError(password: string): string | null {
  return password.length < 12 || password.length > 128
    ? 'Gunakan kata sandi 12–128 karakter. Hindari kata sandi yang pernah digunakan.' : null
}

// Return only known internal destinations, never arbitrary paths from URL/state.
export function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && ['/dashboard', '/settings', '/history', '/admin/dashboard'].includes(value) ? value : null
}

export function identityDestination(identity: { role: 'user' | 'admin'; aal: 'aal1' | 'aal2' }): string {
  return identity.role === 'admin' ? '/admin/dashboard' : '/dashboard'
}
