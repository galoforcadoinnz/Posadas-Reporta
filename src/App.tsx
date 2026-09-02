import { lazy, Suspense, useState } from 'react'
import ReportCategory from './components/ReportCategory'
import ReportDetails from './components/ReportDetails'
import ReportPreview from './components/ReportPreview'
import ReportSuccess from './components/ReportSuccess'
import { env } from './config/env'
import { useReportDraft } from './hooks/useReportDraft'
import { useReportSubmission } from './hooks/useReportSubmission'
import type { Category, Subcategory } from './types/category'
import type { ReportDetailsDraft } from './types/report'

const MapView = lazy(() => import('./components/MapView'))

function App() {
  const {
    reportStep,
    reportDraft,
    selectLocation,
    selectCategory,
    updateDetails,
    completeDetails,
    backToMap,
    backToCategory,
    backToDetails,
    markSubmissionSucceeded,
    resetDraft,
  } = useReportDraft()

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const submission = useReportSubmission()

  const handleLocationContinue = (
    latitude: number,
    longitude: number
  ) => {
    submission.invalidateRequest()

    selectLocation({ latitude, longitude })
  }

  const handleCategoryContinue = (
    category: Category,
    subcategory: Subcategory | null
  ) => {
    submission.invalidateRequest()
    selectCategory(category, subcategory)
  }

  const handleDetailsChange = (
    changes: Partial<ReportDetailsDraft>
  ) => {
    submission.invalidateRequest()
    updateDetails(changes)
  }

  const handleDetailsContinue = () => {
    completeDetails()
  }

  const handleBackToMap = () => {
    backToMap()
  }

  const handleBackToCategory = () => {
    backToCategory()
  }

  const handleBackToDetails = () => {
    backToDetails()
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
      subcategoryId: reportDraft.subcategory?.id ?? null,
      description: reportDraft.description.trim(),
      latitude: reportDraft.location.latitude,
      longitude: reportDraft.location.longitude,
      urgency: reportDraft.urgency,
    })

    setTurnstileToken(null)
    if (receipt) {
      markSubmissionSucceeded()
    }
  }

  const handleCreateAnotherReport = () => {
    submission.reset()
    setTurnstileToken(null)
    resetDraft()
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

          <Suspense
            fallback={(
              <p className="map-instruction" role="status">
                Cargando mapa…
              </p>
            )}
          >
            <MapView
              citySlug={env.citySlug}
              initialLocation={reportDraft.location}
              onContinue={handleLocationContinue}
            />
          </Suspense>
        </main>
      )}

      {reportStep === 'category' &&
        reportDraft.location && (
          <main>
            <ReportCategory
              initialCategory={reportDraft.category}
              initialSubcategory={reportDraft.subcategory}
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
              subcategory={reportDraft.subcategory}
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
              subcategory={reportDraft.subcategory}
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
