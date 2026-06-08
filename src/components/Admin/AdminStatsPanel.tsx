import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

type AdminStatsPanelProps = {
  incidents: any[]
}

export default function AdminStatsPanel({ incidents }: AdminStatsPanelProps) {
  const total = incidents.length

  if (total === 0) {
    return (
      <article className="dashboard-card stats-section admin-stats-section">
        <div className="section-header compact-header">
          <div>
            <h2>Estadísticas generales</h2>
            <p>Resumen visual de incidentes registrados, zonas críticas y tendencias del campus.</p>
          </div>
        </div>

        <div className="admin-stats-panel">
          <p
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            No se encontraron incidentes con los filtros seleccionados.
          </p>
        </div>
      </article>
    )
  }

  const pendientes = incidents.filter((inc) => inc.estado === 'Pendiente').length
  const atendiendo = incidents.filter((inc) => inc.estado === 'Atendido').length
  const cerrados = incidents.filter((inc) => inc.estado === 'Cerrado').length

  const emergencias = incidents.filter((inc) => {
    const tipo = inc.tipo_incidente?.toLowerCase() || ''
    return (
      inc.estado === 'Pendiente' ||
      tipo.includes('incendio') ||
      tipo.includes('accidente') ||
      tipo.includes('agresion') ||
      tipo.includes('agresión')
    )
  }).length

  const countBy = (keyGetter: (incident: any) => string) => {
    const result: Record<string, number> = {}

    incidents.forEach((incident) => {
      const key = keyGetter(incident) || 'Sin definir'
      result[key] = (result[key] || 0) + 1
    })

    return Object.entries(result)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  const estadoData = [
    { name: 'Pendiente', value: pendientes },
    { name: 'Atendiendo', value: atendiendo },
    { name: 'Cerrado', value: cerrados },
  ]

  const tipoData = countBy((inc) => inc.tipo_incidente || 'Sin tipo')

  const zonaData = countBy((inc) => inc.zona?.nombre || 'Sin zona')

  const topZona = zonaData[0]?.name ?? 'Sin datos'

  const yearData = countBy((inc) => {
    const fecha = inc.fecha || inc.created_at
    if (!fecha) return 'Sin fecha'

    const year = new Date(fecha).getFullYear()
    return Number.isNaN(year) ? 'Sin fecha' : String(year)
  }).sort((a, b) => Number(a.name) - Number(b.name))

  const pieColors = ['#ef4444', '#facc15', '#22c55e']

  return (
    <article className="dashboard-card stats-section admin-stats-section">
      <div className="section-header compact-header">
        <div>
          <h2>Estadísticas generales</h2>
          <p>
            Resumen visual de incidentes registrados, zonas críticas y tendencias del campus.
          </p>
        </div>
      </div>

      <div className="admin-stats-panel">
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <span>Total incidentes</span>
            <strong>{total}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Pendientes</span>
            <strong>{pendientes}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Atendiendo</span>
            <strong>{atendiendo}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Cerrados</span>
            <strong>{cerrados}</strong>
          </div>

          <div className="admin-stat-card danger">
            <span>Emergencias activas</span>
            <strong>{emergencias}</strong>
          </div>

          <div className="admin-stat-card">
            <span>Zona más frecuente</span>
            <strong>{topZona}</strong>
          </div>
        </div>

        <div className="admin-charts-grid">
          <div className="admin-chart-card">
            <h3>Incidentes por estado</h3>

            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={estadoData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {estadoData.map((_, index) => (
                      <Cell key={index} fill={pieColors[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-chart-card">
            <h3>Incidentes por tipo</h3>

            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tipoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f2a4a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-chart-card">
            <h3>Zonas con más reportes</h3>

            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zonaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-chart-card">
            <h3>Incidentes por año</h3>

            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#dc2626"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}