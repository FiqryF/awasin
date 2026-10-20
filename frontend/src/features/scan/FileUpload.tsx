import { useEffect, useRef, useState } from 'react'
import { FileVideo, Upload, X } from 'lucide-react'
import { imageTypes, videoTypes } from './scanConfig'

type Props = { label: string; video: boolean; file: File | null; error: string | null; onChange: (file: File | null) => void }

function ImagePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <>{failed && <p className="preview-fallback">Pratinjau tidak dapat ditampilkan. Coba pilih gambar lain.</p>}<img ref={image} hidden={failed} className="file-preview" alt="Pratinjau gambar pilihanmu, belum dianalisis" onLoad={() => setFailed(false)} onError={() => setFailed(true)} /></>
}

export function FileUpload({ label, video, file, error, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="upload-field">
      <label className="field-label" htmlFor="scan-file">{label}</label>
      <div className="upload-zone"><Upload size={25} strokeWidth={1.5} aria-hidden="true" /><span className="upload-title">Pilih {video ? 'video' : 'gambar'} dari perangkatmu</span>
        <span id="file-help">{video ? 'MP4 atau WebM · maksimal 50 MB' : 'JPG, PNG, atau WebP · maksimal 10 MB'}</span>
        <span className="file-picker">Pilih file <span aria-hidden="true">+</span></span>
        <input ref={input} id="scan-file" type="file" accept={(video ? videoTypes : imageTypes).join(',')} aria-describedby={`file-help${error ? ' scan-error' : ''}`} aria-invalid={Boolean(error)}
          onChange={(event) => { onChange(event.target.files?.[0] ?? null); event.target.value = '' }} />
      </div>
      {file && <div className="selected-file">
        {!video && <ImagePreview key={`${file.name}-${file.lastModified}`} file={file} />}{video && <FileVideo size={28} aria-hidden="true" />}
        <div className="file-details"><strong>{file.name}</strong><span>{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024)).toLocaleString('id-ID')} KB` : `${(file.size / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MB`} · hanya di perangkatmu</span></div>
        <button type="button" className="icon-button" aria-label="Hapus file pilihan" onClick={() => { onChange(null); input.current?.focus() }}><X size={19} aria-hidden="true" /></button>
      </div>}
    </div>
  )
}
