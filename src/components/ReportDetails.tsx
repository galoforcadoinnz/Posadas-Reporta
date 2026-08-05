import { useState } from 'react'

type Category = {
  id: string
  icon: string
  name: string
  description: string
}

type ReportLocation = {
  latitude: number
  longitude: number
}

type ReportDetailsProps = {
  location: ReportLocation
  category: Category
  onContinue: (
    description: string,
    photo: File | null,
    urgency: string
  ) => void
  onBack: () => void
}

function ReportDetails({
  location,
  category,
  onContinue,
  onBack,
}: ReportDetailsProps) {

  const [description, setDescription] =
    useState('')

  const [photo, setPhoto] =
    useState<File | null>(null)

  const [urgency, setUrgency] =
    useState('media')

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file =
      event.target.files?.[0] || null

    setPhoto(file)

  }

  const handleContinue = () => {

    if (!description.trim()) {

      alert(
        'Por favor, describí brevemente el problema.'
      )

      return

    }

    onContinue(
      description,
      photo,
      urgency
    )

  }

  return (

    <section className="details-section">

      <button
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

            {category.icon}

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
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          placeholder="Por ejemplo: Hay un bache grande que ocupa casi todo el carril..."
          rows={5}
          maxLength={1000}
        />

        <small>

          {description.length}/1000 caracteres

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

        {photo && (

          <p className="photo-selected">

            📷 Foto seleccionada:

            {' '}

            {photo.name}

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
              value="baja"
              checked={urgency === 'baja'}
              onChange={(event) =>
                setUrgency(event.target.value)
              }
            />

            🟢 Baja

          </label>

          <label>

            <input
              type="radio"
              name="urgency"
              value="media"
              checked={urgency === 'media'}
              onChange={(event) =>
                setUrgency(event.target.value)
              }
            />

            🟡 Media

          </label>

          <label>

            <input
              type="radio"
              name="urgency"
              value="alta"
              checked={urgency === 'alta'}
              onChange={(event) =>
                setUrgency(event.target.value)
              }
            />

            🔴 Alta

          </label>

        </div>

      </div>

      <div className="details-footer">

        <button
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