import { useState } from 'react'
import type { ZonePolygon } from '../../services/polygonService'

interface ZoneLegendProps {
  zones: ZonePolygon[]
  mode?: 'floating' | 'button'
  hideCameras?: boolean
}

export default function ZoneLegend({
  zones,
  mode = 'floating',
  hideCameras = false,
}: ZoneLegendProps) {
  const [isOpen, setIsOpen] = useState(false)

  const incidentTypes = [
    { tipo: 'robo', color: '#FF0000', emoji: '🔓', nombre: 'Robo' },
    { tipo: 'agresion', color: '#FF6600', emoji: '⚠️', nombre: 'Agresión' },
    { tipo: 'vandalismo', color: '#FFAA00', emoji: '🔨', nombre: 'Vandalismo' },
    {
      tipo: 'sospechoso',
      color: '#9900FF',
      emoji: '👁️',
      nombre: 'Sospechoso',
    },
    { tipo: 'accidente', color: '#0066FF', emoji: '🚨', nombre: 'Accidente' },
    { tipo: 'incendio', color: '#FF3300', emoji: '🔥', nombre: 'Incendio' },
  ]

  return (
    <div
      className={
        mode === 'button'
          ? 'zone-legend-inline relative'
          : 'zone-legend-floating absolute bottom-4 left-4 z-40'
      }
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-white text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-full shadow-md border border-gray-200 hover:bg-gray-50"
      >
        Información
      </button>

      {isOpen && (
        <div
          className={
            mode === 'button'
              ? 'zone-legend-panel absolute right-0 top-[calc(100%+0.55rem)] z-[300] w-[min(430px,88vw)] max-h-[min(70vh,520px)] overflow-y-auto bg-white rounded-lg shadow-2xl p-5 border border-gray-200'
              : 'zone-legend-panel mt-2 bg-white rounded-lg shadow-2xl p-5 max-w-md border border-gray-200'
          }
        >
          <div className="flex items-center justify-between gap-3 mb-4 border-b-2 pb-2">
            <h2 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              📍 CAMPUS HUACHI - LEYENDA
            </h2>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Cerrar
            </button>
          </div>

          <div className="mb-5">
            <h3 className="font-semibold text-xs mb-3 text-gray-700 uppercase tracking-wider">
              🏢 ZONAS DE SEGURIDAD
            </h3>

            <div className="space-y-2.5">
              {zones.length > 0 ? (
                zones.map((zone) => (
                  <div key={zone.id} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded border-2 shrink-0 mt-0.5"
                      style={{
                        backgroundColor: zone.color,
                        opacity: 0.4,
                        borderColor: zone.color,
                        borderWidth: '2px',
                      }}
                    />

                    <div className="text-xs flex-1">
                      <p className="font-bold text-gray-800">{zone.nombre}</p>

                      {zone.descripcion && (
                        <p className="text-gray-600 text-xs mt-0.5">
                          {zone.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">
                  No hay zonas registradas para mostrar.
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 pt-4 border-t">
            <h3 className="font-semibold text-xs mb-3 text-gray-700 uppercase tracking-wider">
              ⚠️ TIPOS DE INCIDENTES
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {incidentTypes.map((item) => (
                <div key={item.tipo} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-5 h-5 rounded-full border-2"
                    style={{
                      backgroundColor: item.color,
                      borderColor: item.color,
                    }}
                  />

                  <span className="text-gray-700">
                    {item.emoji} {item.nombre}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!hideCameras && (
            <div className="mb-4 pt-4 border-t">
              <h3 className="font-semibold text-xs mb-3 text-gray-700 uppercase tracking-wider">
                🎥 CÁMARAS
              </h3>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded bg-blue-100 border border-blue-700" />
                  <span className="text-gray-700">Cámara de seguridad</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t">
            <h3 className="font-semibold text-xs mb-3 text-gray-700 uppercase tracking-wider">
              📊 ESTADOS
            </h3>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded bg-red-200 border border-red-700" />
                <span className="text-gray-700">🔴 Pendiente</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-700" />
                <span className="text-gray-700">🟠 Atendido</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded bg-green-200 border border-green-700" />
                <span className="text-gray-700">🟢 Cerrado</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}