import { useEffect, useMemo } from 'react'
import type { Category } from '../types/category'
import type { ReportLocation, Urgency } from '../types/report'

type ReportPreviewProps = {
  location: ReportLocation
  category: Category
  description: string
  photo: File | null
  urgency: Urgency
  isSubmitting: boolean
  submissionError: string | null
  onBack: () => void
  onConfirm: () => void
}

function ReportPreview({
  location,
  category,
  description,
  photo,
  urgency,
  isSubmitting,
  submissionError,
  onBack,
  onConfirm,
}: ReportPreviewProps) {

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo]
  )

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
    }
  }, [photoPreview])

  return (

    <section className="preview-section">

      <button
        type="button"
        className="back-button"
        onClick={onBack}
        disabled={isSubmitting}
      >
        ← Editar reporte
      </button>

      <div className="preview-header">

        <h2>
          👁️ Revisá tu reporte
        </h2>

        <p>
          Verificá que la información sea correcta
          antes de confirmar.
        </p>

      </div>

      <div className="preview-card">

        <div className="preview-item">

          <strong>
            📍 Ubicación
          </strong>

          <p>

            Latitud:

            {' '}

            {location.latitude.toFixed(6)}

            <br />

            Longitud:

            {' '}

            {location.longitude.toFixed(6)}

          </p>

        </div>

        <div className="preview-item">

          <strong>
            🏷️ Categoría
          </strong>

          <p>

            {category.icon ?? '📍'}

            {' '}

            {category.name}

          </p>

        </div>

        <div className="preview-item">

          <strong>
            📝 Descripción
          </strong>

          <p>
            {description}
          </p>

        </div>

        <div className="preview-item">

          <strong>
            🚨 Urgencia
          </strong>

          <p>

            {urgency === 'low' && '🟢 Baja'}

            {urgency === 'medium' && '🟡 Media'}

            {urgency === 'high' && '🔴 Alta'}

          </p>

        </div>

        {photoPreview && (

          <div className="preview-item">

            <strong>
              📸 Fotografía
            </strong>

            <img
              src={photoPreview}
              alt="Vista previa del reporte"
              className="photo-preview"
            />

          </div>

        )}

      </div>

      <div className="preview-warning">

        ⚠️ Al confirmar se enviarán la ubicación, categoría,
        descripción y urgencia. La fotografía se mantiene en
        esta vista previa, pero todavía no se guarda.

      </div>

      <div className="preview-footer">

        <button
          type="button"
          className="edit-button"
          onClick={onBack}
          disabled={isSubmitting}
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          className="confirm-button"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando…' : '✅ Confirmar reporte'}
        </button>

      </div>

      {submissionError && (
        <p className="submission-error" role="alert">
          {submissionError}
        </p>
      )}

    </section>

  )

}

export default ReportPreview
