import { useState } from 'react'
import type { ReportReceipt } from '../types/report'

type ReportSuccessProps = {
  receipt: ReportReceipt
  onCreateAnother: () => void
}

function ReportSuccess({ receipt, onCreateAnother }: ReportSuccessProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.trackingCode)
      setCopyMessage('Código copiado.')
    } catch {
      setCopyMessage('No se pudo copiar. Seleccioná el código manualmente.')
    }
  }

  return (
    <section className="success-section" aria-labelledby="success-title">
      <div className="success-card">
        <h2 id="success-title">✅ Reporte recibido</h2>
        <p>Guardá este código para futuras consultas.</p>

        <div className="tracking-code" aria-label="Código de seguimiento">
          {receipt.trackingCode}
        </div>

        <button type="button" className="copy-button" onClick={handleCopy}>
          Copiar código
        </button>

        {copyMessage && <p role="status">{copyMessage}</p>}

        <dl className="receipt-details">
          <div>
            <dt>Estado</dt>
            <dd>Recibido</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{new Date(receipt.createdAt).toLocaleString('es-AR')}</dd>
          </div>
        </dl>

        <p className="preview-warning">
          Posadas Reporta no reemplaza emergencias ni denuncias oficiales.
        </p>

        <button
          type="button"
          className="continue-button"
          onClick={onCreateAnother}
        >
          Crear otro reporte
        </button>
      </div>
    </section>
  )
}

export default ReportSuccess
