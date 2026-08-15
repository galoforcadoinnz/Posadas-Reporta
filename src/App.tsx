import { useState } from 'react'
import MapView from './components/MapView'
import ReportCategory from './components/ReportCategory'
import ReportDetails from './components/ReportDetails'
import ReportPreview from './components/ReportPreview'
import ReportSuccess from './components/ReportSuccess'
import { env } from './config/env'
import { useReportSubmission } from './hooks/useReportSubmission'
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

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const submission = useReportSubmission()

  const handleLocationContinue = (
    latitude: number,
    longitude: number
  ) => {
    submission.invalidateRequest()

    setReportDraft((currentDraft) => ({
      ...currentDraft,
      location: { latitude, longitude },
    }))

    setReportStep('category')
  }

  const handleCategoryContinue = (
    category: Category
  ) => {
    submission.invalidateRequest()
    setReportDraft((currentDraft) => ({
      ...currentDraft,
      category,
    }))
    setReportStep('details')
  }

  const handleDetailsChange = (
    changes: Partial<ReportDetailsDraft>
  ) => {
    submission.invalidateRequest()
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
      return
    }

    if (!turnstileToken) {
      return
    }

    const receipt = await submission.submit({
      turnstileToken,
      citySlug: env.citySlug,
      categoryId: reportDraft.category.id,
      subcategoryId: null,
      description: reportDraft.description.trim(),
      latitude: reportDraft.location.latitude,
      longitude: reportDraft.location.longitude,
      urgency: reportDraft.urgency,
    })

    setTurnstileToken(null)
    if (receipt) {
      setReportStep('success')
    }
  }

  const handleCreateAnotherReport = () => {
    submission.reset()
    setTurnstileToken(null)
    setReportDraft(INITIAL_REPORT_DRAFT)
    setReportStep('map')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🟢 Posadas Reporta</h1>

        <p>
          Informá los problemas de tu ciudad
        </p>
      </header>

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
            citySlug={env.citySlug}
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
              isSubmitting={submission.isSubmitting}
              submissionError={submission.submissionError}
              turnstileToken={turnstileToken}
              turnstileGeneration={submission.turnstileGeneration}
              onTurnstileTokenChange={setTurnstileToken}
              onBack={handleBackToDetails}
              onConfirm={handleConfirmReport}
            />
          </main>
        )}

      {reportStep === 'success' && submission.receipt && (
        <main>
          <ReportSuccess
            receipt={submission.receipt}
            onCreateAnother={handleCreateAnotherReport}
          />
        </main>
      )}
    </div>
  )
}

export default App
