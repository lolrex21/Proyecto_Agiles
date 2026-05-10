import { useState } from 'react'
import Header from '../Header'
import SearchBar from '../SearchBar'
import IncidentMap from '../Map/IncidentMap'
import IncidentList from '../IncidentList'
import { useIncidents } from '../../hooks/useIncidents'

export default function GuardDashboard() {
  const {
    incidents,
    loading,
    selectedIncident,
    setSelectedIncident,
    updateStatus,
    handleSearch,
  } = useIncidents()

  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />

      <main className="flex-1 p-4 overflow-y-auto max-w-7xl w-full mx-auto">
        <SearchBar onSearch={handleSearch} />

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('split')}
            className={`px-4 py-2 rounded ${
              viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            📊 Dividida
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded ${
              viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            🗺️ Mapa
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded ${
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            📋 Lista
          </button>
        </div>

        <div className={`grid gap-4 ${
          viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
        } h-96`}>
          {(viewMode === 'split' || viewMode === 'map') && (
            <div className="rounded-lg overflow-hidden">
              <IncidentMap
                incidents={incidents}
                loading={loading}
                onMarkerClick={setSelectedIncident}
              />
            </div>
          )}

          {(viewMode === 'split' || viewMode === 'list') && (
            <IncidentList
              incidents={incidents}
              loading={loading}
              onSelect={setSelectedIncident}
              onStatusUpdate={updateStatus}
            />
          )}
        </div>

        {selectedIncident && (
          <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg max-w-sm">
            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <h3 className="font-bold mb-2">{selectedIncident.tipo_incidente}</h3>
            <p className="text-sm text-gray-700 mb-2">{selectedIncident.descripcion}</p>
            <p className="text-xs text-gray-600">
              Estado: <strong>{selectedIncident.estado}</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}