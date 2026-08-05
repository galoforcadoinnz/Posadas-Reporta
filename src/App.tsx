import { createReport } from './services/reports'
import { useState } from 'react'
import MapView from './components/MapView'
import ReportCategory from './components/ReportCategory'
import ReportDetails from './components/ReportDetails'
import ReportPreview from './components/ReportPreview'
import type { Category } from './types/category'

type ReportLocation = {
  latitude: number
  longitude: number
}

type ReportStep =
  | 'map'
  | 'category'
  | 'details'
  | 'preview'

function App() {
  const [reportStep, setReportStep] =
    useState<ReportStep>('map')

  const [reportLocation, setReportLocation] =
    useState<ReportLocation | null>(null)

  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null)

  const [description, setDescription] =
    useState('')

  const [photo, setPhoto] =
    useState<File | null>(null)

  const [urgency, setUrgency] =
    useState('medium')

  const handleLocationContinue = (
    latitude: number,
    longitude: number
  ) => {
    setReportLocation({
      latitude,
      longitude,
    })

    setReportStep('category')
  }

  const handleCategoryContinue = (
    category: Category
  ) => {
    setSelectedCategory(category)
    setReportStep('details')
  }

  const handleDetailsContinue = (
    reportDescription: string,
    reportPhoto: File | null,
    reportUrgency: string
  ) => {
    setDescription(reportDescription)
    setPhoto(reportPhoto)
    setUrgency(reportUrgency)
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
  if (!reportLocation || !selectedCategory) {
    alert(
      'Faltan datos obligatorios del reporte.'
    )
    return
  }

  try {
    const createdReport = await createReport({
      categoryId: selectedCategory.id,
      subcategoryId: null,
      description,
      latitude: reportLocation.latitude,
      longitude: reportLocation.longitude,
      address: null,
      urgency:
        urgency === 'baja'
          ? 'low'
          : urgency === 'alta'
            ? 'high'
            : 'medium',
    })

    alert(
      `Reporte creado correctamente.\nID: ${createdReport.id}`
    )

    setReportStep('map')
    setReportLocation(null)
    setSelectedCategory(null)
    setDescription('')
    setPhoto(null)
    setUrgency('medium')
  } catch (err) {
    console.error(err)

    if (err instanceof Error) {
      alert(
        `No se pudo guardar el reporte: ${err.message}`
      )
    } else {
      alert(
        'No se pudo guardar el reporte.'
      )
    }
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
            onContinue={handleLocationContinue}
          />
        </main>
      )}

      {reportStep === 'category' &&
        reportLocation && (
          <main>
            <ReportCategory
              onContinue={handleCategoryContinue}
              onBack={handleBackToMap}
            />
          </main>
        )}

      {reportStep === 'details' &&
        reportLocation &&
        selectedCategory && (
          <main>
            <ReportDetails
              location={reportLocation}
              category={selectedCategory}
              onContinue={handleDetailsContinue}
              onBack={handleBackToCategory}
            />
          </main>
        )}

      {reportStep === 'preview' &&
        reportLocation &&
        selectedCategory && (
          <main>
            <ReportPreview
              location={reportLocation}
              category={selectedCategory}
              description={description}
              photo={photo}
              urgency={urgency}
              onBack={handleBackToDetails}
              onConfirm={handleConfirmReport}
            />
          </main>
        )}
    </div>
  )
}

export default App