import { ArrowUpRight, Globe, Image, Link as LinkIcon, MessageSquare, QrCode } from 'lucide-react'
import { Link } from 'react-router'
import { scanRoutes } from '../routes/routeConfig'

const icons = { link: LinkIcon, message: MessageSquare, website: Globe, qr: QrCode, media: Image }

export function HomePage() {
  return (
    <>
      <section aria-labelledby="home-title" className="max-w-2xl">
        <h1 id="home-title" className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Cek Dulu, <br /><span className="text-brand">Lebih Aman.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">AWASIN membantu masyarakat memeriksa indikasi penipuan digital melalui tautan, pesan, website, QR Code, serta gambar dan video dengan bantuan AI.</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">Frontend sedang disiapkan. Semua menu pemeriksaan di bawah membuka halaman pengembangan dan belum melakukan analisis.</p>
      </section>
      <section aria-labelledby="scan-title" className="mt-12 max-w-3xl">
        <h2 id="scan-title" className="mb-3 text-xl font-semibold">Pilih jenis pemeriksaan</h2>
        <ul className="divide-y divide-line border-y border-line">
          {scanRoutes.map(({ path, title, description, icon }) => {
            const Icon = icons[icon]
            return (
              <li key={path}>
                <Link to={path} className="group flex items-center gap-4 rounded-sm py-5 hover:bg-white sm:px-3">
                  <Icon className="shrink-0 text-brand" size={23} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold group-hover:text-brand">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
                  </div>
                  <ArrowUpRight size={19} aria-hidden="true" className="shrink-0 text-brand" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
