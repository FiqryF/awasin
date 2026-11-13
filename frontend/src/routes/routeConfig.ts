export const scanRoutes = [
  { path: '/scan/link', title: 'Link & Website Inspector', description: 'Periksa tautan dan indikasi penyamaran alamat website.', icon: 'link' },
  { path: '/scan/message', title: 'Message Analyzer', description: 'Tinjau pesan mencurigakan melalui teks atau screenshot.', icon: 'message' },
  { path: '/scan/qr', title: 'QR Code Security Scanner', description: 'Periksa isi QR Code dari gambar atau kamera.', icon: 'qr' },
  { path: '/scan/media', title: 'AI Media Authenticity Analyzer', description: 'Tinjau indikasi manipulasi pada gambar dan video.', icon: 'media' },
] as const

// Non-public routes require a server-verified identity; admin routes require the current database admin role.
// /login, /register, /forgot-password, /reset-password, /verify-email sudah menjadi halaman nyata.
export const placeholderRoutes = [
  { path: '/settings', title: 'Pengaturan Akun', access: 'user' },
] as const
