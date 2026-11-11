// VITE_* values are public browser configuration. Never put secrets here.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(public readonly status: number) { super(`Permintaan API gagal (${status}).`) }
}

export async function apiRequest<T>(path: `/${string}`, options?: RequestInit): Promise<T> {
  if (path.startsWith('//')) throw new Error('Gunakan path API relatif yang diawali satu slash.')
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (!response.ok) throw new ApiError(response.status)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
