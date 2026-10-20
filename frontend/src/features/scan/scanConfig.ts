import { Globe2, Image, Link, MessageSquare, QrCode, Video } from 'lucide-react'

export const scanTypes = [
  { id: 'link', label: 'Link', icon: Link, title: 'Periksa tautan sebelum dibuka.', description: 'Tempel tautan yang ingin kamu periksa. Tidak perlu membuka situsnya.', fieldLabel: 'Link yang ingin diperiksa' },
  { id: 'message', label: 'Pesan', icon: MessageSquare, title: 'Ada pesan yang bikin ragu?', description: 'Tempel isi pesan atau pilih screenshot. Hapus informasi pribadi yang tidak diperlukan.', fieldLabel: 'Isi pesan yang ingin diperiksa' },
  { id: 'website', label: 'Website', icon: Globe2, title: 'Pastikan alamatnya, bukan tampilannya.', description: 'Pemeriksaan website dirancang untuk meninjau indikasi domain tiruan dan penyamaran situs resmi.', fieldLabel: 'Alamat website yang ingin diperiksa' },
  { id: 'qr', label: 'QR Code', icon: QrCode, title: 'Jangan buru-buru scan.', description: 'Pilih gambar QR Code yang ingin diperiksa. Kamera belum tersedia pada tahap ini.', fieldLabel: 'Gambar QR Code' },
  { id: 'image', label: 'Gambar', icon: Image, title: 'Lihat lebih teliti, sebelum percaya.', description: 'Pilih gambar untuk persiapan analisis indikasi manipulasi atau konten sintetis.', fieldLabel: 'Gambar yang ingin diperiksa' },
  { id: 'video', label: 'Video', icon: Video, title: 'Yang terlihat nyata, perlu ditinjau juga.', description: 'Gambar dan video adalah dua mode dari fitur analisis keaslian media yang sama.', fieldLabel: 'Video yang ingin diperiksa' },
] as const

export type ScanType = typeof scanTypes[number]['id']
export type ScanConfig = typeof scanTypes[number]
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
export const videoTypes = ['video/mp4', 'video/webm']

export function validateFile(file: Pick<File, 'size' | 'type'>, mode: ScanType): string | null {
  const isVideo = mode === 'video'
  const limit = isVideo ? 50 : 10
  if (!(isVideo ? videoTypes : imageTypes).includes(file.type)) return isVideo ? 'Pilih video berformat MP4 atau WebM.' : 'Pilih gambar berformat JPG, PNG, atau WebP.'
  if (file.size === 0) return 'File kosong. Pilih file lain.'
  if (file.size > limit * 1024 * 1024) return `Ukuran file melebihi ${limit} MB. Pilih file yang lebih kecil.`
  return null
}

function validateUrl(text: string): string | null {
  try {
    const url = new URL(text.trim())
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('Invalid URL')
    return null
  } catch { return 'Masukkan alamat lengkap dengan https:// atau http://, misalnya https://contoh.com.' }
}

function validateMessage(text: string, hasFile: boolean): string | null {
  if (!hasFile && text.trim().length < 10) return 'Masukkan sedikitnya 10 karakter pesan, atau pilih screenshot.'
  if (text.length > 10000) return 'Pesan terlalu panjang. Batasi hingga 10.000 karakter.'
  return null
}

export function validateScanInput(mode: ScanType, text: string, file: Pick<File, 'size' | 'type'> | null): string | null {
  if (file) {
    const error = validateFile(file, mode)
    if (error) return error
  }
  if (mode === 'link' || mode === 'website') return validateUrl(text)
  if (mode === 'message') return validateMessage(text, Boolean(file))
  if (!file) return mode === 'video' ? 'Pilih video yang ingin diperiksa terlebih dahulu.' : 'Pilih gambar yang ingin diperiksa terlebih dahulu.'
  return null
}
