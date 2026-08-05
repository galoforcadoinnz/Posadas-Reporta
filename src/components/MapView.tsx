import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet'

import L from 'leaflet'
import { useState } from 'react'
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

  // Obtener ubicación mediante GPS
  const getCurrentLocation = () => {

    if (!navigator.geolocation) {

      alert(
        'Tu navegador no permite obtener la ubicación.'
      )

      return
    }

    navigator.geolocation.getCurrentPosition(

      (position) => {

        const latitude =
          position.coords.latitude

        const longitude =
          position.coords.longitude

        setSelectedLocation([
          latitude,
          longitude,
        ])

      },

      () => {

        alert(
          'No pudimos obtener tu ubicación. Verificá los permisos de ubicación de tu navegador.'
        )

      }

    )

  }

  // Seleccionar ubicación manualmente
  const handleLocationSelected = (
    latitude: number,
    longitude: number
  ) => {

    setSelectedLocation([
      latitude,
      longitude,
    ])

  }

  // Continuar con la ubicación seleccionada
  const handleContinue = () => {

    if (!selectedLocation) {

      alert(
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
        >
          📍 Usar mi ubicación
        </button>

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

      {selectedLocation && (

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
