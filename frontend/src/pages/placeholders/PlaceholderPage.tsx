import { Link } from 'react-router'

type PlaceholderPageProps = { title: string; access: 'public' | 'user' | 'admin' }

export function PlaceholderPage({ title, access }: PlaceholderPageProps) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-5 leading-relaxed text-muted">Fitur ini masih dalam pengembangan. Belum ada pemeriksaan, pengiriman data, atau proses autentikasi yang dilakukan.</p>
      {access !== 'public' && <p className="mt-3 leading-relaxed text-muted">Halaman {access === 'admin' ? 'administrator' : 'pengguna'} ini belum diproteksi. Pembatasan akses akan ditambahkan setelah integrasi Supabase Auth.</p>}
      <Link to="/" className="action-link mt-8 inline-flex">Kembali ke beranda</Link>
    </section>
  )
}
