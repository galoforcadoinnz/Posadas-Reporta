import { useEffect, useState } from 'react'
import { getCategories } from '../services/categories'
import { getSubcategories } from '../services/subcategories'
import type { Category, Subcategory } from '../types/category'

type ReportCategoryProps = {
  initialCategory: Category | null
  initialSubcategory: Subcategory | null
  onContinue: (category: Category, subcategory: Subcategory | null) => void
  onBack: () => void
}

function ReportCategory({
  initialCategory,
  initialSubcategory,
  onContinue,
  onBack,
}: ReportCategoryProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(initialCategory)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<Subcategory | null>(initialSubcategory)
  const [subcategoriesLoading, setSubcategoriesLoading] =
    useState(initialCategory !== null)
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(null)
  const [subcategoriesReload, setSubcategoriesReload] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories()
        setCategories(data)
      } catch {
        setError('No se pudieron cargar las categorías. Intentá nuevamente.')
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  useEffect(() => {
    if (!selectedCategory) {
      return
    }

    let active = true
    getSubcategories(selectedCategory.id)
      .then((data) => {
        if (!active) {
          return
        }

        setSubcategories(data)
        setSelectedSubcategory((current) =>
          current && data.some((subcategory) => subcategory.id === current.id)
            ? current
            : null
        )
      })
      .catch(() => {
        if (!active) {
          return
        }

        setSubcategories([])
        setSelectedSubcategory(null)
        setSubcategoriesError(
          'No pudimos cargar el detalle de esta categoría. Podés reintentar o continuar sin especificarlo.'
        )
      })
      .finally(() => {
        if (active) {
          setSubcategoriesLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [selectedCategory, subcategoriesReload])

  const handleCategorySelection = (category: Category) => {
    if (selectedCategory?.id !== category.id) {
      setSubcategories([])
      setSelectedSubcategory(null)
      setSubcategoriesError(null)
      setSubcategoriesLoading(true)
    }

    setSelectedCategory(category)
  }

  const handleSubcategoriesRetry = () => {
    setSubcategoriesError(null)
    setSubcategoriesLoading(true)
    setSubcategoriesReload((value) => value + 1)
  }

  const handleContinue = () => {
    if (!selectedCategory) {
      return
    }

    onContinue(selectedCategory, selectedSubcategory)
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
        <p className="category-message" role="status">
          Cargando categorías...
        </p>
      )}

      {error && (
        <div className="category-error" role="alert">
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
                  onClick={() => handleCategorySelection(category)}
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

          {selectedCategory && (
            <fieldset className="subcategory-fieldset">
              <legend>¿Podés precisar el tipo de problema?</legend>
              <p>Es opcional y ayuda a clasificar mejor el reporte.</p>

              {subcategoriesLoading && (
                <p className="category-message" role="status">
                  Cargando opciones...
                </p>
              )}

              {subcategoriesError && (
                <div className="category-error" role="alert">
                  <p>{subcategoriesError}</p>
                  <button
                    type="button"
                    className="retry-button"
                    onClick={handleSubcategoriesRetry}
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!subcategoriesLoading && !subcategoriesError && (
                <div className="subcategory-options">
                  <label>
                    <input
                      type="radio"
                      name="subcategory"
                      checked={selectedSubcategory === null}
                      onChange={() => setSelectedSubcategory(null)}
                    />
                    Sin especificar
                  </label>

                  {subcategories.map((subcategory) => (
                    <label key={subcategory.id}>
                      <input
                        type="radio"
                        name="subcategory"
                        checked={selectedSubcategory?.id === subcategory.id}
                        onChange={() => setSelectedSubcategory(subcategory)}
                      />
                      <span>
                        {subcategory.name}
                        {subcategory.description && (
                          <small>{subcategory.description}</small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          <div className="category-footer">
            <button
              type="button"
              className="continue-button"
              onClick={handleContinue}
              disabled={!selectedCategory || subcategoriesLoading}
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
