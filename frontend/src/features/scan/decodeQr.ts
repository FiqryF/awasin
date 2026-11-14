import { normalizeWebsiteInput } from './scanConfig'

type QrPixels = Readonly<{ data: Uint8ClampedArray; width: number; height: number }>
type QrDecoder = typeof import('jsqr')['default']
let decoder: Promise<QrDecoder> | undefined

export async function decodeQrPixels(pixels: QrPixels): Promise<string | null> {
  decoder ??= import('jsqr').then(module => module.default)
  const code = (await decoder)(pixels.data, pixels.width, pixels.height)
  if (!code?.data) return null
  if (code.data.length > 4096) throw new Error('Isi QR terlalu panjang untuk ditampilkan. Batasnya 4.096 karakter.')
  return code.data
}

export async function decodeQr(file: File): Promise<string> {
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer())
  const png=signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71
  const jpg=signature[0]===255&&signature[1]===216&&signature[2]===255
  const webp=String.fromCodePoint(...signature.slice(0,4))==='RIFF'&&String.fromCodePoint(...signature.slice(8,12))==='WEBP'
  if(!png&&!jpg&&!webp)throw new Error('Isi file bukan gambar JPG, PNG, atau WebP yang didukung.')
  const bitmap=await createImageBitmap(file)
  try {
    if(bitmap.width*bitmap.height>20_000_000)throw new Error('Resolusi gambar terlalu besar. Gunakan gambar QR di bawah 20 megapiksel.')
    const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height))
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    const context=canvas.getContext('2d',{willReadFrequently:true})
    if(!context)throw new Error('Pembacaan gambar tidak didukung browser ini.')
    context.drawImage(bitmap,0,0,canvas.width,canvas.height)
    const pixels=context.getImageData(0,0,canvas.width,canvas.height)
    const value = await decodeQrPixels(pixels)
    if (!value) throw new Error('QR Code tidak ditemukan. Pilih gambar yang lebih jelas.')
    return value
  } finally {bitmap.close()}
}

export function decodedHttpUrl(value: string): string | null {
  const normalized = normalizeWebsiteInput(value.trim())
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export function qrPayloadGuidance(value: string): string {
  const payload = value.trim()
  if (/^WIFI:/i.test(payload)) {
    return 'QR ini berisi konfigurasi Wi‑Fi dan mungkin kata sandi. AWASIN tidak memverifikasi keamanan jaringan; jangan bagikan isi ini kepada orang lain.'
  }
  if (/^(?:BEGIN:VCARD(?:\r?\n|$)|mailto:|tel:)/i.test(payload)) {
    return 'QR ini mungkin berisi informasi kontak pribadi. Periksa isi dan sumbernya sebelum bertindak; AWASIN tidak membuka atau mengimpor data ini otomatis.'
  }
  return 'Isi QR ini bukan tautan HTTP(S). Isi tidak dikirim atau dibuka otomatis; pemeriksaan payload di backend hanya dilakukan jika kamu menyetujuinya.'
}
