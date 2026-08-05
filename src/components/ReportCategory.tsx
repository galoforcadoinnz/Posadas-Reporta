import { useEffect, useState } from 'react'
import { getCategories } from '../services/categories'
import type { Category } from '../types/category'

type ReportCategoryProps = {
  initialCategory: Category | null
  onContinue: (category: Category) => void
  onBack: () => void
}

function ReportCategory({
  initialCategory,
  onContinue,
  onBack,
}: ReportCategoryProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(initialCategory)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories()
        setCategories(data)
      } catch (err) {
        console.error('Error al cargar categorías:', err)

        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('No se pudieron cargar las categorías.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  const handleContinue = () => {
    if (!selectedCategory) {
      alert('Seleccioná una categoría para continuar.')
      return
    }

    onContinue(selectedCategory)
  }

  return (
    <section className="category-section">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        ← Volver al mapa
      </button>

      <div className="category-header">
        <h2>¿Qué problema querés informar?</h2>

        <p>
          Seleccioná la categoría que mejor describe
          el problema.
        </p>
      </div>

      {loading && (
        <p className="category-message">
          Cargando categorías...
        </p>
      )}

      {error && (
        <div className="category-error">
          <strong>
            No pudimos cargar las categorías.
          </strong>

          <p>{error}</p>

          <button
            type="button"
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <p className="category-message">
          No hay categorías disponibles.
        </p>
      )}

      {!loading && !error && categories.length > 0 && (
        <>
          <div className="category-grid">
            {categories.map((category) => {
              const isSelected =
                selectedCategory?.id === category.id

              return (
                <button
                  type="button"
                  key={category.id}
                  className={
                    isSelected
                      ? 'category-card selected'
                      : 'category-card'
                  }
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                >
                  <span className="category-icon">
                    {category.icon ?? '📍'}
                  </span>

                  <span className="category-name">
                    {category.name}
                  </span>

                  {category.description && (
                    <span className="category-description">
                      {category.description}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="category-footer">
            <button
              type="button"
              className="continue-button"
              onClick={handleContinue}
              disabled={!selectedCategory}
            >
              Continuar →
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default ReportCategory
