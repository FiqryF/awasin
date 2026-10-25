import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Download, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth'
import type { Identity } from '../features/auth/identity'
import { usePreferences } from '../features/settings/context'
import { accountRequest, type Preferences } from '../features/settings/api'
import { changeAccountPassword } from '../features/settings/changePassword'
import { useLogout } from '../features/auth/useLogout'
import { FormField } from '../components/auth/FormField'
import { PasswordField } from '../components/auth/PasswordField'
import { DeleteHistoryDialog } from '../features/history/DeleteHistoryDialog'
import './settings.css'

const sections = { profile: 'Profil Saya', security: 'Keamanan Akun', privacy: 'Privasi & Data', preferences: 'Preferensi' }
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Permintaan belum berhasil. Coba lagi.'

export function SettingsPage() {
  const {identity}=useAuth()
  return identity?<SettingsContent key={identity.id} identity={identity}/>:null
}
function SettingsContent({identity}:Readonly<{identity:Identity}>) {
  const [params,setParams]=useSearchParams()
  const requested=params.get('section')??'profile'
  const selected=Object.hasOwn(sections,requested)?requested as keyof typeof sections:'profile'
  const initials=(identity.profile.display_name||identity.email).split(/\s+/).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('id-ID')
  return <section className="settings-page" aria-labelledby="settings-title">
    <header className="settings-heading"><div><h1 id="settings-title">Pengaturan Akun</h1><p>Atur identitas, keamanan, dan pilihan privasimu di satu tempat.</p></div><div className="settings-identity"><span className="settings-avatar" aria-hidden="true">{initials}</span><div><strong>{identity.profile.display_name||'Pengguna AWASIN'}</strong><p>{identity.email}</p></div></div></header>
    <nav className="settings-navigation" aria-label="Kategori pengaturan">{Object.entries(sections).map(([id,label])=><button type="button" key={id} aria-current={selected===id?'page':undefined} onClick={()=>setParams({section:id},{replace:true,preventScrollReset:true})}>{label}</button>)}</nav>
    <div className="settings-content" key={selected}>
      {selected==='profile'&&<ProfileSettings identity={identity}/>}
      {selected==='security'&&<SecuritySettings identity={identity}/>}
      {selected==='privacy'&&<PrivacySettings identity={identity}/>}
      {selected==='preferences'&&<PreferenceSettings/>}
    </div>
  </section>
}

function ProfileSettings({identity}:Readonly<{identity:Identity}>) {
  const {refresh}=useAuth()
  const [name,setName]=useState(identity.profile.display_name)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  async function save(event:SubmitEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return
    const trimmed=name.trim()
    if(!trimmed||trimmed.length>100){setError('Nama tampilan harus berisi 1–100 karakter.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const result=await accountRequest('/profiles/me','PATCH',{display_name:trimmed},undefined,identity.id)
      if(!result||typeof result!=='object'||!('id' in result)||result.id!==identity.id||!('display_name' in result)||typeof result.display_name!=='string')throw new Error('Respons profil tidak valid.')
      setName(result.display_name);setMessage('Nama tampilan berhasil disimpan.')
      await refresh()
    }catch(error){setError(errorMessage(error))}finally{setBusy(false)}
  }
  return <><div className="settings-intro"><h2>Identitas yang kamu gunakan.</h2><p>Nama tampilan dipakai pada sapaan dashboard dan menu akunmu.</p></div><form className="settings-form" noValidate onSubmit={save}><FormField id="settings-name" label="Nama tampilan" value={name} maxLength={100} required autoComplete="name" onChange={event=>setName(event.target.value)}/><FormField id="settings-email" label="Email akun" type="email" value={identity.email} readOnly hint="Email dikelola oleh layanan autentikasi. Perubahan email belum tersedia di halaman ini."/><p className="settings-verification"><ShieldCheck size={18} aria-hidden="true"/>Email telah diverifikasi untuk mengakses akun ini.</p>{error&&<p role="alert" className="settings-feedback">{error}</p>}{message&&<output className="settings-feedback">{message}</output>}<button type="submit" className="button button-red" disabled={busy}>{busy?'Menyimpan…':'Simpan nama tampilan'}</button></form><p className="settings-footnote">Avatar menggunakan inisial. Unggah foto belum tersedia karena penyimpanan avatar belum dikonfigurasi.</p></>
}

function SecuritySettings({identity}:Readonly<{identity:Identity}>) {
  const confirmLogout = useLogout()
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false),[changed,setChanged]=useState(false),[error,setError]=useState('')
  const active=useRef(true)
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
  async function change(event:SubmitEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return
    setBusy(true);setError('');setChanged(false)
    try{await changeAccountPassword(identity,current,password,confirm);if(active.current){setCurrent('');setPassword('');setConfirm('');setChanged(true)}}
    catch(error){if(active.current)setError(errorMessage(error))}finally{if(active.current)setBusy(false)}
  }
  async function logout(){
    if(busy)return
    setBusy(true);setError('')
    try{await confirmLogout()}
    catch(error){if(active.current){setError(errorMessage(error));setBusy(false)}}
  }
  return <><div className="settings-intro"><h2>Jaga akses tetap milikmu.</h2><p>Kata sandi saat ini diverifikasi kembali oleh penyedia sebelum kata sandi baru disimpan. Isinya tidak disimpan dalam profil AWASIN.</p></div><form className="settings-form" noValidate onSubmit={change}><PasswordField id="settings-current-password" label="Kata sandi saat ini" value={current} onChange={setCurrent}/><PasswordField id="settings-new-password" label="Kata sandi baru" value={password} onChange={setPassword} autoComplete="new-password" hint="Gunakan 8–128 karakter dan hindari kata sandi yang digunakan di layanan lain."/><PasswordField id="settings-confirm-password" label="Konfirmasi kata sandi baru" value={confirm} onChange={setConfirm} autoComplete="new-password"/>{error&&<p role="alert" className="settings-feedback">{error}</p>}{changed&&<output className="settings-feedback">Kata sandi berhasil diubah. Untuk menutup sesi perangkat ini, gunakan tombol Keluar di bawah.</output>}<button type="submit" className="button button-red" disabled={busy}>{busy?'Memproses…':'Simpan kata sandi baru'}</button></form><div className="settings-data-row"><div><h3>Sesi perangkat ini</h3><p>Akses akun telah diverifikasi. Daftar perangkat dan lokasi login tidak dikumpulkan oleh halaman ini.</p><Link className="auth-link" to="/forgot-password">Lupa kata sandi?</Link></div><button className="button history-secondary" type="button" disabled={busy} onClick={()=>void logout()}><LogOut size={18} aria-hidden="true"/>Keluar</button></div></>
}

function PreferenceEditor({kind}:Readonly<{kind:'history'|'animation'}>) {
  const {value,error:updateError,update,reload}=usePreferences()
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  async function save(next:Preferences){
    if(busy)return
    setBusy(true);setError('');setMessage('')
    try{await update(next);setMessage('Pilihan berhasil disimpan.')}catch(error){setError(errorMessage(error))}finally{setBusy(false)}
  }
  if(!value)return <div className="settings-feedback">{updateError?<p role="alert">{updateError}</p>:<output>Memuat preferensi akun…</output>}{updateError&&<button type="button" className="button history-secondary" onClick={reload}>Coba lagi</button>}</div>
  const history=kind==='history'
  return <div className="settings-preference"><label htmlFor={`settings-${kind}`}>{history?'Penyimpanan laporan baru':'Gerakan dan animasi'}</label><select id={`settings-${kind}`} disabled={busy} value={history?value.history_retention:value.animation} onChange={event=>void save(history?{...value,history_retention:event.target.value as Preferences['history_retention']}:{...value,animation:event.target.value as Preferences['animation']})}>{history?<><option value="manual">Izinkan simpan secara manual</option><option value="disabled">Nonaktifkan penyimpanan baru</option></>:<><option value="system">Ikuti sistem</option><option value="reduced">Kurangi animasi</option></>}</select>{busy&&<output>Menyimpan pilihan…</output>}{error&&<p role="alert">{error}</p>}{message&&<output>{message}</output>}</div>
}

function PrivacySettings({identity}:Readonly<{identity:Identity}>) {
  const [deleting,setDeleting]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const active=useRef(true)
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
  async function download(){
    if(busy)return
    setBusy(true);setError('');setMessage('')
    try{
      const data=await accountRequest('/account/export','GET',undefined,undefined,identity.id)
      if(!active.current)return
      if(!data||typeof data!=='object'||!('profile' in data)||!data.profile||typeof data.profile!=='object'||!('id' in data.profile)||data.profile.id!==identity.id)throw new Error('Identitas ekspor tidak valid.')
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob),anchor=document.createElement('a')
      anchor.href=url;anchor.download='awasin-data.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
      setMessage('Berkas ekspor telah disiapkan dan diteruskan ke browser.')
    }catch(error){if(active.current)setError(errorMessage(error))}finally{if(active.current)setBusy(false)}
  }
  return <><div className="settings-intro"><h2>Datamu, pilihanmu.</h2><p>Tentukan apakah laporan baru boleh disimpan. Pilihan ini tidak menghapus laporan yang sudah ada dan tidak pernah mengaktifkan simpan otomatis.</p></div><PreferenceEditor kind="history"/><div className="settings-data-row"><div><h3>Yang disimpan di akun</h3><p>Nama tampilan, email autentikasi, preferensi, serta ringkasan aman dan hasil analisis yang kamu pilih untuk disimpan. Pesan mentah, file media, screenshot, kata sandi, OTP, dan token bukan bagian dari riwayat atau ekspor ini.</p><p>Draf Feedback berada di memori halaman. Setelah dikirim dengan persetujuan dan dikonfirmasi layanan, teks serta referensi pilihan disimpan terpisah; menghapus riwayat tidak menghapus Feedback. Data teknis autentikasi dikelola penyedia akun.</p></div></div><div className="settings-data-row"><div><h3>Ekspor data pribadi</h3><p>Unduh JSON berisi profil, preferensi, laporan tersimpan dan Feedback terkait akunmu. Batasnya 500 laporan dan 500 masukan; permintaan lebih besar ditolak tanpa ekspor sebagian. Simpan berkas ini di tempat pribadi.</p></div><button type="button" className="button history-secondary" disabled={busy} onClick={()=>void download()}><Download size={18} aria-hidden="true"/>{busy?'Menyiapkan…':'Unduh data JSON'}</button></div>{error&&<p role="alert" className="settings-feedback">{error}</p>}{message&&<output className="settings-feedback">{message}</output>}<div className="settings-data-row"><div><h3>Hapus seluruh riwayat</h3><p>Hapus permanen laporan tersimpan milik akun ini. Profil dan preferensi tidak ikut dihapus. Tidak ada file unggahan yang disimpan oleh fitur scan saat ini.</p></div><button type="button" className="button history-secondary" onClick={()=>setDeleting(true)}>Hapus riwayat</button></div><div className="settings-danger"><h3>Hapus Akun Saya</h3><p>Belum tersedia. Penghapusan harus mencakup identitas autentikasi, profil, preferensi, dan laporan terkait melalui layanan tepercaya dengan verifikasi ulang. Menghapus profil saja tidak menutup akun.</p><button type="button" className="button history-secondary" disabled>Penghapusan akun belum tersedia</button></div>{deleting&&<DeleteHistoryDialog onClose={()=>setDeleting(false)} onDeleted={count=>{setDeleting(false);setMessage(`${count} laporan berhasil dihapus.`)}}/>}</>
}

function PreferenceSettings() {
  return <><div className="settings-intro"><h2>Nyaman digunakan, sesuai kebutuhanmu.</h2><p>Ikuti pengaturan gerakan perangkat atau kurangi animasi secara khusus untuk akun ini. Pilihan diterapkan ke transisi dan video latar; umpan balik tombol tetap tersedia.</p></div><PreferenceEditor kind="animation"/><p className="settings-footnote">Tampilan gelap AWASIN tetap digunakan. Ukuran teks dapat diatur melalui pembesaran browser. Mode penjelasan sederhana belum tersedia.</p></>
}
