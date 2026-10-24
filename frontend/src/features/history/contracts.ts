export const analysisStatuses = ['pending', 'processing', 'completed', 'failed', 'unsupported'] as const
export const riskLabels = { low: 'Risiko rendah', medium: 'Risiko sedang', high: 'Risiko tinggi', inconclusive: 'Belum dapat disimpulkan' }
export const statusLabels = { pending: 'Menunggu analisis', processing: 'Sedang dianalisis', completed: 'Analisis selesai', failed: 'Analisis gagal', unsupported: 'Belum didukung' }
export type ScanMode = 'link' | 'message' | 'website' | 'qr' | 'image' | 'video'
export type Risk = keyof typeof riskLabels
export type HistorySummary = { id: string; mode: ScanMode; created_at: string; saved_at: string | null; safe_label: string; status: typeof analysisStatuses[number]; risk: Risk | null }
export type AnalysisResult = { risk: Risk | null; findings: { title: string; description: string }[]; sources: { name: string; reference: string | null }[]; checks: { name: string; status: 'completed' | 'failed' | 'not_performed' | 'unsupported'; detail: string | null }[]; recommendations: string[] }
export type ReportDetail = HistorySummary & { engine: string | null; engine_version: string | null; analyzed_at: string | null; result: AnalysisResult }
export type HistoryData = { items: HistorySummary[]; next_cursor: string | null }
const modes = new Set(['link', 'message', 'website', 'qr', 'image', 'video'])
export const modeLabels: Record<ScanMode, string> = { link: 'Link', message: 'Pesan', website: 'Website', qr: 'QR Code', image: 'Gambar', video: 'Video' }
export const validReportId = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const risk = (value: unknown) => value === null || (typeof value === 'string' && Object.hasOwn(riskLabels, value))
const nullable = (value: unknown, max: number) => value === null || text(value, max)
function summary(value: unknown): value is HistorySummary {
  return object(value) && validReportId(value.id) && modes.has(String(value.mode)) && date(value.created_at) && (value.saved_at === null || date(value.saved_at)) && text(value.safe_label,160) && analysisStatuses.includes(value.status as HistorySummary['status']) && risk(value.risk) && (value.status === 'completed' || value.risk === null)
}
export function parseHistory(value: unknown): HistoryData {
  if (!object(value) || !Array.isArray(value.items) || value.items.length > 50 || !value.items.every(item=>summary(item) && item.saved_at !== null) || !(value.next_cursor === null || text(value.next_cursor,300))) throw new Error('Respons riwayat tidak valid.')
  return value as HistoryData
}
export function parseReport(value: unknown): ReportDetail {
  if (!summary(value)) throw new Error('Respons laporan tidak valid.')
  const row = value as HistorySummary & Record<string, unknown>
  const result = row.result
  if (!nullable(row.engine,120) || !nullable(row.engine_version,80) || !(row.analyzed_at === null || date(row.analyzed_at)) || !object(result) || !risk(result.risk) || result.risk !== row.risk) throw new Error('Metadata laporan tidak valid.')
  if (row.status === 'completed' && (!row.engine || !row.engine_version || !row.analyzed_at)) throw new Error('Asal analisis belum terverifikasi.')
  if (!Array.isArray(result.findings) || result.findings.length>30 || !result.findings.every(f=>object(f)&&text(f.title,160)&&text(f.description,2000))) throw new Error('Temuan tidak valid.')
  if (!Array.isArray(result.sources) || result.sources.length>20 || !result.sources.every(s=>object(s)&&text(s.name,160)&&nullable(s.reference,500))) throw new Error('Sumber tidak valid.')
  if (!Array.isArray(result.checks) || result.checks.length>30 || !result.checks.every(c=>object(c)&&text(c.name,160)&&['completed','failed','not_performed','unsupported'].includes(String(c.status))&&nullable(c.detail,1000))) throw new Error('Status pemeriksaan tidak valid.')
  if (!Array.isArray(result.recommendations) || result.recommendations.length>20 || !result.recommendations.every(r=>text(r,1000))) throw new Error('Rekomendasi tidak valid.')
  return row as ReportDetail
}
