export const scanRoutes = [
  { path: '/scan/link', title: 'Link Inspector', description: 'Periksa indikasi phishing dan risiko pada tautan.', icon: 'link' },
  { path: '/scan/message', title: 'Message Analyzer', description: 'Tinjau pesan mencurigakan melalui teks atau screenshot.', icon: 'message' },
  { path: '/scan/website', title: 'Fake Website Detector', description: 'Kenali indikasi website palsu dan domain tiruan.', icon: 'website' },
  { path: '/scan/qr', title: 'QR Security Scanner', description: 'Periksa isi QR Code dari kamera atau unggahan gambar.', icon: 'qr' },
  { path: '/scan/media', title: 'AI Media Authenticity Analyzer', description: 'Tinjau indikasi manipulasi pada gambar dan video.', icon: 'media' },
] as const

// Non-public routes require a server-verified identity; admin routes require the current database admin role.
// /login, /register, /forgot-password, /reset-password, /verify-email sudah menjadi halaman nyata.
export const placeholderRoutes = [
  ...scanRoutes.map((route) => ({ ...route, access: 'public' as const })),
  { path: '/education', title: 'Scam Education Center', access: 'public' },
  { path: '/history', title: 'Scan History', access: 'user' },
  { path: '/settings', title: 'Pengaturan Akun', access: 'user' },
  { path: '/admin', title: 'Administrator', access: 'admin' },
  { path: '/admin/domains', title: 'Kelola Domain Resmi', access: 'admin' },
  { path: '/admin/articles', title: 'Kelola Artikel Edukasi', access: 'admin' },
  { path: '/admin/feedback', title: 'Moderasi Feedback', access: 'admin' },
] as const
