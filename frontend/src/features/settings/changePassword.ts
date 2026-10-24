import { reauthenticationClient } from '../auth/client'
import { passwordError } from '../auth/policy'

export async function changeAccountPassword(owner: {id:string;email:string}, current: string, password: string, confirm: string) {
  const invalid=passwordError(password)
  if(!current||current.length>128||invalid||password!==confirm)throw new Error(invalid??'Periksa kata sandi saat ini dan konfirmasi kata sandi baru.')
  const client=reauthenticationClient()
  try {
    const verified=await client.auth.signInWithPassword({email:owner.email,password:current})
    if(verified.error||!verified.data.session||verified.data.user?.id!==owner.id)throw new Error('Verifikasi kata sandi saat ini gagal. Periksa kembali atau coba nanti.')
    const {error}=await client.auth.updateUser({password,current_password:current})
    if(error)throw new Error(error.code==='same_password'?'Gunakan kata sandi baru yang berbeda.':'Kata sandi belum diubah. Kebijakan penyedia mungkin memerlukan verifikasi tambahan; coba alur lupa sandi.')
  } finally {
    // Only the short-lived verification session is signed out, never other devices.
    await client.auth.signOut({scope:'local'}).catch(()=>undefined)
  }
}
