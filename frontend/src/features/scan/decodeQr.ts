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
    const {default:jsQR}=await import('jsqr')
    const code=jsQR(pixels.data,pixels.width,pixels.height)
    if(!code?.data)throw new Error('QR Code tidak ditemukan. Pilih gambar yang lebih jelas.')
    if(code.data.length>4096)throw new Error('Isi QR terlalu panjang untuk ditampilkan. Batasnya 4.096 karakter.')
    return code.data
  } finally {bitmap.close()}
}
export function decodedHttpUrl(value:string):string|null {
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null} catch{return null}
}
