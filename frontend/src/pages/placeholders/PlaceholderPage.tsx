import { Link } from 'react-router'

type PlaceholderPageProps = Readonly<{ title: string; access: 'public' | 'user' | 'admin' }>

export function PlaceholderPage({ title, access }: PlaceholderPageProps) {
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-5 leading-relaxed text-muted">Fitur ini masih dalam pengembangan. Belum ada pemeriksaan atau hasil analisis pada halaman ini.</p>
      {access !== 'public' && <p className="mt-3 leading-relaxed text-muted">Akses {access === 'admin' ? 'administrator' : 'pengguna'} telah diperiksa melalui layanan identitas.</p>}
      <Link to="/" className="action-link mt-8 inline-flex">Kembali ke beranda</Link>
    </section>
  )
}
