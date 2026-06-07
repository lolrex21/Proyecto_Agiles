import { type ChangeEvent } from 'react'

export interface IncidentFilters {
  text: string
  dateFrom: string
  dateTo: string
  timeFrom: string
  timeTo: string
  zone: string
  estado: string
  tipo: string
}

interface SearchBarProps {
  filters: IncidentFilters
  zones: Array<{ id: number; nombre: string }>
  onChange: (filters: IncidentFilters) => void
}

export default function SearchBar({ filters, zones, onChange }: SearchBarProps) {
  const handleInput = (key: keyof IncidentFilters) => (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    onChange({ ...filters, [key]: e.target.value })
  }

  return (
    <div className="search-panel bg-white rounded-2xl shadow p-4 mb-6">
      <div className="search-fields grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.4fr_1fr_1fr_0.9fr_0.9fr_1fr_1fr_1fr]">
        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Texto
          </span>
          <input
            type="text"
            value={filters.text}
            onChange={handleInput('text')}
            placeholder="Descripción, usuario, zona..."
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Fecha desde
          </span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={handleInput('dateFrom')}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Fecha hasta
          </span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={handleInput('dateTo')}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Hora desde
          </span>
          <input
            type="time"
            value={filters.timeFrom}
            onChange={handleInput('timeFrom')}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Hora hasta
          </span>
          <input
            type="time"
            value={filters.timeTo}
            onChange={handleInput('timeTo')}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Zona
          </span>
          <select
            value={filters.zone}
            onChange={handleInput('zone')}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Estado
          </span>
          <select
            value={filters.estado}
            onChange={handleInput('estado')}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Atendido">Atendiendo</option>
            <option value="Cerrado">Cerrado</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-[0.12em]">
            Tipo
          </span>
          <select
            value={filters.tipo}
            onChange={handleInput('tipo')}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="Robo">Robo</option>
            <option value="Agresión">Agresión</option>
            <option value="Vandalismo">Vandalismo</option>
            <option value="Sospechoso">Sospechoso</option>
            <option value="Accidente">Accidente</option>
            <option value="Incendio">Incendio</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
      </div>
    </div>
  )
}