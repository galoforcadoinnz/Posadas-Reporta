import type { Category } from '../types/category'
import type {
  ReportDetailsDraft,
  ReportLocation,
  Urgency,
} from '../types/report'

type ReportDetailsProps = {
  location: ReportLocation
  category: Category
  details: ReportDetailsDraft
  onChange: (changes: Partial<ReportDetailsDraft>) => void
  onContinue: () => void
  onBack: () => void
}

function ReportDetails({
  location,
  category,
  details,
  onChange,
  onContinue,
  onBack,
}: ReportDetailsProps) {

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file =
      event.target.files?.[0] || null

    onChange({ photo: file })

  }

  const handleContinue = () => {

    if (!details.description.trim()) {

      alert(
        'Por favor, describí brevemente el problema.'
      )

      return

    }

    onContinue()

  }

  return (

    <section className="details-section">

      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Volver
      </button>

      <div className="details-header">

        <h2>
          📝 Detalles del problema
        </h2>

        <p>
          Contanos un poco más sobre lo que ocurre.
        </p>

      </div>

      <div className="report-summary">

        <div className="summary-item">

          <strong>
            📍 Ubicación
          </strong>

          <span>

            {location.latitude.toFixed(6)}

            {' '}

            {location.longitude.toFixed(6)}

          </span>

        </div>

        <div className="summary-item">

          <strong>
            🏷️ Categoría
          </strong>

          <span>

            {category.icon ?? '📍'}

            {' '}

            {category.name}

          </span>

        </div>

      </div>

      <div className="form-group">

        <label htmlFor="description">

          ¿Qué está pasando?

        </label>

        <textarea
          id="description"
          value={details.description}
          onChange={(event) =>
            onChange({ description: event.target.value })
          }
          placeholder="Por ejemplo: Hay un bache grande que ocupa casi todo el carril..."
          rows={5}
          maxLength={1000}
        />

        <small>

          {details.description.length}/1000 caracteres

        </small>

      </div>

      <div className="form-group">

        <label htmlFor="photo">

          📸 Agregar una fotografía

        </label>

        <input
          id="photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
        />

        {details.photo && (

          <p className="photo-selected">

            📷 Foto seleccionada:

            {' '}

            {details.photo.name}

          </p>

        )}

      </div>

      <div className="form-group">

        <label>

          🚨 Nivel de urgencia

        </label>

        <div className="urgency-options">

          <label>

            <input
              type="radio"
              name="urgency"
              value="low"
              checked={details.urgency === 'low'}
              onChange={(event) =>
                onChange({ urgency: event.target.value as Urgency })
              }
            />

            🟢 Baja

          </label>

          <label>

            <input
              type="radio"
              name="urgency"
              value="medium"
              checked={details.urgency === 'medium'}
              onChange={(event) =>
                onChange({ urgency: event.target.value as Urgency })
              }
            />

            🟡 Media

          </label>

          <label>

            <input
              type="radio"
              name="urgency"
              value="high"
              checked={details.urgency === 'high'}
              onChange={(event) =>
                onChange({ urgency: event.target.value as Urgency })
              }
            />

            🔴 Alta

          </label>

        </div>

      </div>

      <div className="details-footer">

        <button
          type="button"
          className="continue-button"
          onClick={handleContinue}
        >
          Ver resumen →
        </button>

      </div>

    </section>

  )

}

export default ReportDetails
