import { createReport } from './services/reports'
import { useState } from 'react'
import MapView from './components/MapView'
import ReportCategory from './components/ReportCategory'
import ReportDetails from './components/ReportDetails'
import ReportPreview from './components/ReportPreview'
import type { Category } from './types/category'
import type {
  ReportDetailsDraft,
  ReportDraft,
  ReportStep,
} from './types/report'

const INITIAL_REPORT_DRAFT: ReportDraft = {
  location: null,
  category: null,
  description: '',
  photo: null,
  urgency: 'medium',
}

function App() {
  const [reportStep, setReportStep] =
    useState<ReportStep>('map')

  const [reportDraft, setReportDraft] =
    useState<ReportDraft>(INITIAL_REPORT_DRAFT)

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [submissionError, setSubmissionError] =
    useState<string | null>(null)

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null)

  const handleLocationContinue = (
    latitude: number,
    longitude: number
  ) => {
    setSuccessMessage(null)

    setReportDraft((currentDraft) => ({
      ...currentDraft,
      location: { latitude, longitude },
    }))

    setReportStep('category')
  }

  const handleCategoryContinue = (
    category: Category
  ) => {
    setReportDraft((currentDraft) => ({
      ...currentDraft,
      category,
    }))
    setReportStep('details')
  }

  const handleDetailsChange = (
    changes: Partial<ReportDetailsDraft>
  ) => {
    setReportDraft((currentDraft) => ({
      ...currentDraft,
      ...changes,
    }))
  }

  const handleDetailsContinue = () => {
    setReportStep('preview')
  }

  const handleBackToMap = () => {
    setReportStep('map')
  }

  const handleBackToCategory = () => {
    setReportStep('category')
  }

  const handleBackToDetails = () => {
    setReportStep('details')
  }

  const handleConfirmReport = async () => {
    if (
      !reportDraft.location ||
      !reportDraft.category ||
      !reportDraft.description.trim()
    ) {
      setSubmissionError('Faltan datos obligatorios del reporte.')
      return
    }

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      await createReport({
        categoryId: reportDraft.category.id,
        subcategoryId: null,
        description: reportDraft.description.trim(),
        latitude: reportDraft.location.latitude,
        longitude: reportDraft.location.longitude,
        address: null,
        urgency: reportDraft.urgency,
      })

      setReportDraft(INITIAL_REPORT_DRAFT)
      setReportStep('map')
      setSuccessMessage('Reporte creado correctamente.')
    } catch {
      setSubmissionError('No se pudo guardar el reporte. Intentá nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🟢 Posadas Reporta</h1>

        <p>
          Informá los problemas de tu ciudad
        </p>
      </header>

      {successMessage && (
        <p className="app-feedback success" role="status">
          {successMessage}
        </p>
      )}

      {reportStep === 'map' && (
        <main>
          <section className="hero">
            <h2>
              ¿Qué problema querés informar?
            </h2>

            <p>
              Primero seleccioná en el mapa
              dónde está el problema.
            </p>
          </section>

          <MapView
            initialLocation={reportDraft.location}
            onContinue={handleLocationContinue}
          />
        </main>
      )}

      {reportStep === 'category' &&
        reportDraft.location && (
          <main>
            <ReportCategory
              initialCategory={reportDraft.category}
              onContinue={handleCategoryContinue}
              onBack={handleBackToMap}
            />
          </main>
        )}

      {reportStep === 'details' &&
        reportDraft.location &&
        reportDraft.category && (
          <main>
            <ReportDetails
              location={reportDraft.location}
              category={reportDraft.category}
              details={reportDraft}
              onChange={handleDetailsChange}
              onContinue={handleDetailsContinue}
              onBack={handleBackToCategory}
            />
          </main>
        )}

      {reportStep === 'preview' &&
        reportDraft.location &&
        reportDraft.category && (
          <main>
            <ReportPreview
              location={reportDraft.location}
              category={reportDraft.category}
              description={reportDraft.description}
              photo={reportDraft.photo}
              urgency={reportDraft.urgency}
              isSubmitting={isSubmitting}
              submissionError={submissionError}
              onBack={handleBackToDetails}
              onConfirm={handleConfirmReport}
            />
          </main>
        )}
    </div>
  )
}

export default App
