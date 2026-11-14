import type { ReactNode } from 'react'

export function ScanResultDetails({ recommendations, findings, children }: Readonly<{
  recommendations: string[]
  findings: ReadonlyArray<{ explanation: string; source: string }>
  children?: ReactNode
}>) {
  const [nextStep, ...otherSteps] = recommendations
  return <>
    {nextStep && <p className="url-result-next"><strong>Saran tindakan</strong> {nextStep}</p>}
    {(findings.length > 0 || otherSteps.length > 0 || children) && <details className="url-technical">
      <summary>Lihat detail</summary>
      <div className="url-technical-body">
        {findings.length > 0 && <section>
          <h5>Temuan pemeriksaan</h5>
          <ul>{findings.map(({ explanation, source }, index) => <li key={`${source}-${index}`}>
            {explanation} <small className="url-report-note">{source}</small>
          </li>)}</ul>
        </section>}
        {children}
        {otherSteps.length > 0 && <section>
          <h5>Saran lainnya</h5>
          <ul>{otherSteps.map(step => <li key={step}>{step}</li>)}</ul>
        </section>}
      </div>
    </details>}
  </>
}
