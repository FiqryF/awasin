export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  for (const character of email) {
    if (character.trim() === '') return false
  }
  const separator = email.indexOf('@')
  if (separator < 1 || separator !== email.lastIndexOf('@')) return false
  const domain = email.slice(separator + 1)
  const dot = domain.indexOf('.', 1)
  return dot > 0 && dot < domain.length - 1
}
