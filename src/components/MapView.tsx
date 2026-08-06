import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet'

import L from 'leaflet'
import { useEffect, useState } from 'react'
import { getActiveCity } from '../services/cities'
import type { CityReportingBounds } from '../types/city'
import type { ReportLocation } from '../types/report'

import 'leaflet/dist/leaflet.css'

// Configuración de los iconos de Leaflet
const defaultIconPrototype = L.Icon.Default.prototype as {
  _getIconUrl?: () => string
}

delete defaultIconPrototype._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',

  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',

  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Centro de Posadas
const POSADAS_CENTER: [number, number] = [
  -27.3621,
  -55.9009,
]

type MapViewProps = {
  citySlug: string
  initialLocation: ReportLocation | null
  onContinue: (
    latitude: number,
    longitude: number
  ) => void
}

// Componente que detecta los clics sobre el mapa
function MapClickHandler({
  onLocationSelected,
}: {
  onLocationSelected: (
    latitude: number,
    longitude: number
  ) => void
}) {

  useMapEvents({

    click(event) {

      onLocationSelected(
        event.latlng.lat,
        event.latlng.lng
      )

    },

  })

  return null
}

function MapView({
  citySlug,
  initialLocation,
  onContinue,
}: MapViewProps) {

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState<[number, number] | null>(() =>
    initialLocation
      ? [initialLocation.latitude, initialLocation.longitude]
      : null
  )

  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [reportingBounds, setReportingBounds] =
    useState<CityReportingBounds | null>(null)
  const [isLoadingCity, setIsLoadingCity] = useState(true)

  useEffect(() => {
    let active = true

    getActiveCity(citySlug)
      .then((city) => {
        if (!active) return
        if (!city.reportingBounds) {
          setLocationError(
            'Los reportes no están habilitados temporalmente para esta ciudad.'
          )
          return
        }
        setReportingBounds(city.reportingBounds)
      })
      .catch(() => {
        if (active) {
          setLocationError('No se pudo cargar la configuración de la ciudad.')
        }
      })
      .finally(() => {
        if (active) setIsLoadingCity(false)
      })

    return () => {
      active = false
    }
  }, [citySlug])

  const isInsideReportingBounds = (
    latitude: number,
    longitude: number
  ) =>
    reportingBounds !== null &&
    latitude >= reportingBounds.minLatitude &&
    latitude <= reportingBounds.maxLatitude &&
    longitude >= reportingBounds.minLongitude &&
    longitude <= reportingBounds.maxLongitude

  // Obtener ubicación mediante GPS
  const getCurrentLocation = () => {

    if (!reportingBounds) {
      setLocationError('Los reportes no están habilitados temporalmente.')
      return
    }

    if (!navigator.geolocation) {
      setLocationError('Tu navegador no permite obtener la ubicación.')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(

      (position) => {

        const latitude =
          position.coords.latitude

        const longitude =
          position.coords.longitude

        if (!isInsideReportingBounds(latitude, longitude)) {
          setLocationError('Tu ubicación está fuera del área habilitada.')
          setIsLocating(false)
          return
        }

        setSelectedLocation([latitude, longitude])

        setIsLocating(false)

      },

      () => {
        setLocationError(
          'No pudimos obtener tu ubicación. Verificá los permisos de ubicación de tu navegador.'
        )

        setIsLocating(false)

      }

    )

  }

  // Seleccionar ubicación manualmente
  const handleLocationSelected = (
    latitude: number,
    longitude: number
  ) => {

    if (!isInsideReportingBounds(latitude, longitude)) {
      setLocationError('La ubicación está fuera del área habilitada.')
      return
    }

    setSelectedLocation([
      latitude,
      longitude,
    ])

    setLocationError(null)

  }

  // Continuar con la ubicación seleccionada
  const handleContinue = () => {

    if (!selectedLocation) {
      setLocationError(
        'Primero seleccioná en el mapa dónde está el problema.'
      )

      return

    }

    onContinue(
      selectedLocation[0],
      selectedLocation[1]
    )

  }

  return (

    <div className="map-container">

      <div className="map-controls">

        <button
          type="button"
          className="location-button"
          onClick={getCurrentLocation}
          disabled={isLocating || isLoadingCity || !reportingBounds}
        >
          {isLoadingCity
            ? 'Cargando ciudad…'
            : isLocating
            ? 'Buscando ubicación…'
            : '📍 Usar mi ubicación'}
        </button>

        {locationError && (
          <p className="map-error" role="alert">
            {locationError}
          </p>
        )}

        <div className="map-instruction">

          👆 Tocá el mapa para indicar
          dónde está el problema.

        </div>

      </div>

      <MapContainer
        center={POSADAS_CENTER}
        zoom={13}
        scrollWheelZoom={true}
        className="posadas-map"
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler
          onLocationSelected={
            handleLocationSelected
          }
        />

        {selectedLocation && (

          <Marker
            position={selectedLocation}
          >

            <Popup>

              <strong>
                📍 Ubicación seleccionada
              </strong>

              <br />

              Latitud:
              {' '}
              {selectedLocation[0].toFixed(6)}

              <br />

              Longitud:
              {' '}
              {selectedLocation[1].toFixed(6)}

            </Popup>

          </Marker>

        )}

      </MapContainer>

      {selectedLocation && reportingBounds && (

        <div className="selected-location">

          <strong>
            📍 Ubicación seleccionada
          </strong>

          <p>

            Latitud:
            {' '}
            {selectedLocation[0].toFixed(6)}

            <br />

            Longitud:
            {' '}
            {selectedLocation[1].toFixed(6)}

          </p>

          <button
            type="button"
            className="continue-button"
            onClick={handleContinue}
          >
            Continuar →
          </button>

        </div>

      )}

    </div>

  )

}

export default MapView
