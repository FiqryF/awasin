export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Minimal 8 karakter.'
  if (password.length > 128) return 'Maksimal 128 karakter.'
  return null
}

// Return only known internal destinations, never arbitrary paths from URL/state.
export function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && (['/dashboard', '/settings', '/history', '/admin/dashboard'].includes(value)||/^\/history\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) ? value : null
}

export function identityDestination(identity: { role: 'user' | 'admin'; aal: 'aal1' | 'aal2' }): string {
  return identity.role === 'admin' ? '/admin/dashboard' : '/dashboard'
}
