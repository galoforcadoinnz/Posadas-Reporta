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

type ReportPreviewProps = {
  location: ReportLocation
  category: Category
  description: string
  photo: File | null
  urgency: string
  onBack: () => void
  onConfirm: () => void
}

function ReportPreview({
  location,
  category,
  description,
  photo,
  urgency,
  onBack,
  onConfirm,
}: ReportPreviewProps) {

  const photoPreview =
    photo
      ? URL.createObjectURL(photo)
      : null

  return (

    <section className="preview-section">

      <button
        className="back-button"
        onClick={onBack}
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

            {category.icon}

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

            {urgency === 'baja' && '🟢 Baja'}

            {urgency === 'media' && '🟡 Media'}

            {urgency === 'alta' && '🔴 Alta'}

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

        ⚠️ Este reporte todavía no fue enviado.
        Al confirmar, en la siguiente versión
        podremos guardarlo y asignarle un número
        de seguimiento.

      </div>

      <div className="preview-footer">

        <button
          className="edit-button"
          onClick={onBack}
        >
          ✏️ Editar
        </button>

        <button
          className="confirm-button"
          onClick={onConfirm}
        >
          ✅ Confirmar reporte
        </button>

      </div>

    </section>

  )

}

export default ReportPreview