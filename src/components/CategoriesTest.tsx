import { useEffect, useState } from 'react'
import { getCategories } from '../services/categories'

type Category = {
  id: string
  name: string
  description: string | null
  icon: string | null
  is_active: boolean
  created_at: string
}

export default function CategoriesTest() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories()
        setCategories(data)
      } catch (err) {
        console.error('ERROR DE SUPABASE:', err)

        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Ocurrió un error desconocido.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  if (loading) {
    return <p>Cargando categorías...</p>
  }

  if (error) {
    return (
      <div>
        <h2>Error al cargar las categorías</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Categorías disponibles</h2>

      {categories.length === 0 ? (
        <p>No hay categorías activas.</p>
      ) : (
        <ul>
          {categories.map((category) => (
            <li key={category.id}>
              <strong>
                {category.icon && `${category.icon} `}
                {category.name}
              </strong>

              {category.description && (
                <span> — {category.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}