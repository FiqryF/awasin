import { useEffect, useRef, useState } from 'react'
import { requireSupabase } from '../auth/client'

const bucket = 'account-avatars'
const changed = 'awasin-avatar-change'
export async function avatarStorage(owner: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error || data.session?.user.id !== owner) throw new Error('Akun aktif telah berubah. Muat ulang halaman.')
  return client.storage.from(bucket)
}
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) throw new Error('Pilih foto JPG, PNG, atau WebP maksimal 2 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 24_000_000) throw new Error('Resolusi foto terlalu besar. Gunakan foto di bawah 24 megapiksel.')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser belum mendukung pemrosesan foto.')
    const size = Math.min(bitmap.width, bitmap.height)
    context.fillStyle = '#161a13'; context.fillRect(0, 0, 256, 256)
    context.drawImage(bitmap, (bitmap.width-size)/2, (bitmap.height-size)/2, size, size, 0, 0, 256, 256)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Foto belum dapat diproses.')), 'image/jpeg', .88))
  } finally { bitmap.close() }
}
export function useAvatar(owner: string) {
  const [image, setImage] = useState<{owner:string;url:string}|null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const active = useRef(true)
  const saving = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    const reload = () => setRevision(value => value + 1)
    window.addEventListener(changed, reload)
    return () => window.removeEventListener(changed, reload)
  }, [])
  useEffect(() => {
    let cancelled = false
    let objectUrl: string | undefined
    if(!owner)return
    async function load() {
      try {
        const storage = await avatarStorage(owner)
        const listed = await storage.list(owner, { search: 'avatar.jpg', limit: 10 })
        if (listed.error) throw listed.error
        if(cancelled)return
        setError('')
        if (!listed.data.some(file => file.name === 'avatar.jpg')) { setImage(null); return }
        const result = await storage.download(`${owner}/avatar.jpg`)
        if (result.error) throw result.error
        if (!cancelled) { objectUrl = URL.createObjectURL(result.data); setImage({owner,url:objectUrl}) }
      } catch { if (!cancelled) { setImage(null); setError('Foto profil belum dapat dimuat. Periksa koneksi atau konfigurasi penyimpanan avatar.') } }
    }
    void load()
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [owner, revision])
  async function save(file: File | null) {
    if (saving.current) return
    saving.current = true
    setBusy(true); setError('')
    try {
      const blob = file ? await prepareAvatar(file) : null
      const storage = await avatarStorage(owner)
      if (blob) {
        const result = await storage.upload(`${owner}/avatar.jpg`, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' })
        if (result.error) throw new Error('Foto belum tersimpan. Periksa koneksi dan pastikan penyimpanan avatar telah dikonfigurasi.')
      } else {
        const result = await storage.remove([`${owner}/avatar.jpg`])
        if (result.error || !result.data?.some(item => item.name === `${owner}/avatar.jpg`)) throw new Error('Foto belum berhasil dihapus. Muat ulang dan coba lagi.')
      }
      window.dispatchEvent(new Event(changed))
      return true
    } catch (error) {
      if (active.current) setError(error instanceof Error ? error.message : 'Foto belum dapat diproses.')
      return false
    } finally { saving.current = false; if (active.current) setBusy(false) }
  }
  return { url: image?.owner===owner?image.url:null, error, busy, save }
}
