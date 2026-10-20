import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="mt-5 text-muted">Alamat yang Anda buka tidak tersedia. Pilih pemeriksaan dari beranda untuk melanjutkan.</p>
      <Link to="/" className="action-link mt-8 inline-flex">Kembali ke beranda</Link>
    </section>
  )
}
