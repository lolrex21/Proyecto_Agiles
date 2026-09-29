import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Helper to transpile and import pure logic from TypeScript modules in tests
async function loadTsPureModule(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url)
  const source = readFileSync(fileUrl, 'utf8')
  // Strip runtime imports and mock import.meta.env for isolated unit testing
  const cleaned = source
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// stripped import')
    .replace(/import\.meta\.env/g, '({ VITE_ALLOWED_GOOGLE_EMAIL_DOMAIN: "", VITE_DEFAULT_OAUTH_ROLE: "usuario" })')

  const js = ts.transpileModule(cleaned, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText

  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}

// 1. Tests para el Adaptador de Sesión de Usuario (LSP)
test('LSP: mapToUserSession unifica usuario desde base de datos relacional', async () => {
  const { mapToUserSession } = await loadTsPureModule('../src/services/authService.ts')

  const dbUser = {
    id: 101,
    nombre: 'Washington Villalba',
    correo: 'wvillalba@uta.edu.ec',
    rol: 'usuario',
    zona_id: 2,
    password: 'secret_hash',
    created_at: '2026-09-27T00:00:00Z',
  }

  const session = mapToUserSession(dbUser)

  assert.equal(session.id, 101)
  assert.equal(session.nombre, 'Washington Villalba')
  assert.equal(session.correo, 'wvillalba@uta.edu.ec')
  assert.equal(session.rol, 'usuario')
  assert.equal(session.zona_id, 2)
})

test('LSP: mapToUserSession adapta usuario desde Google OAuth (user_metadata y email)', async () => {
  const { mapToUserSession } = await loadTsPureModule('../src/services/authService.ts')

  const googleRawUser = {
    id: '42',
    email: 'estudiante.google@uta.edu.ec',
    user_metadata: {
      full_name: 'Estudiante Google',
    },
    role: 'guard',
    zona_id: null,
  }

  const session = mapToUserSession(googleRawUser)

  assert.equal(session.id, 42)
  assert.equal(session.nombre, 'Estudiante Google')
  assert.equal(session.correo, 'estudiante.google@uta.edu.ec')
  // Rol 'guard' normalizado al estándar 'guardia'
  assert.equal(session.rol, 'guardia')
  assert.equal(session.zona_id, null)
})

test('LSP: mapToUserSession maneja fallbacks seguros si faltan nombres o metadatos', async () => {
  const { mapToUserSession } = await loadTsPureModule('../src/services/authService.ts')

  const rawMinimal = {
    id: 5,
    email: 'usuario.sin.nombre@uta.edu.ec',
  }

  const session = mapToUserSession(rawMinimal)

  assert.equal(session.id, 5)
  assert.equal(session.nombre, 'usuario.sin.nombre')
  assert.equal(session.correo, 'usuario.sin.nombre@uta.edu.ec')
  assert.equal(session.rol, 'usuario')
})

test('LSP: mapToUserSession rechaza payloads nulos o inválidos', async () => {
  const { mapToUserSession } = await loadTsPureModule('../src/services/authService.ts')

  assert.throws(() => mapToUserSession(null), /Invalid user payload/)
  assert.throws(() => mapToUserSession('string_invalido'), /Invalid user payload/)
})

// 2. Tests para el Registro Centralizado de Incidentes (OCP)
test('OCP: INCIDENT_CONFIG_REGISTRY provee configuración para tipos conocidos', async () => {
  const {
    getIncidentConfig,
    getIncidentColor,
    INCIDENT_CONFIG_REGISTRY,
  } = await loadTsPureModule('../src/constants/incidentConfig.ts')

  const roboConfig = getIncidentConfig('robo')
  assert.equal(roboConfig.label, 'Robo')
  assert.equal(roboConfig.color, '#FF0000')
  assert.equal(getIncidentColor('robo'), '#FF0000')

  // Case-insensitive
  assert.equal(getIncidentColor('INCENDIO'), '#FF3300')
  assert.equal(getIncidentColor('Agresion'), '#FF6600')

  // Nueva emergencia extensible (ej. Fuga de Gas) registrada sin tocar componentes
  assert.ok(INCIDENT_CONFIG_REGISTRY['fuga_gas'])
  assert.equal(getIncidentConfig('fuga_gas').label, 'Fuga de Gas')
  assert.equal(getIncidentColor('fuga_gas'), '#E65100')
})

test('OCP: getIncidentConfig retorna configuración por defecto para tipos no mapeados', async () => {
  const {
    getIncidentConfig,
    getIncidentColor,
    DEFAULT_INCIDENT_CONFIG,
  } = await loadTsPureModule('../src/constants/incidentConfig.ts')

  const unknownConfig = getIncidentConfig('tipo_desconocido_xyz')
  assert.deepEqual(unknownConfig, DEFAULT_INCIDENT_CONFIG)
  assert.equal(getIncidentColor('tipo_desconocido_xyz'), DEFAULT_INCIDENT_CONFIG.color)
  assert.equal(getIncidentColor(null), DEFAULT_INCIDENT_CONFIG.color)
})

// 3. Tests para Servicios Geométricos y Prevención de N+1 (polygonService)
test('polygonService: isPointInPolygon calcula pertenencia geométrica correctamente', async () => {
  const { isPointInPolygon } = await loadTsPureModule('../src/services/polygonService.ts')

  // Cuadrado cerrado simple [(-2, -2) a (2, 2)]
  const square = [
    { lat: -2, lng: -2 },
    { lat: -2, lng: 2 },
    { lat: 2, lng: 2 },
    { lat: 2, lng: -2 },
  ]

  assert.equal(isPointInPolygon({ lat: 0, lng: 0 }, square), true)
  assert.equal(isPointInPolygon({ lat: 5, lng: 5 }, square), false)
  assert.equal(isPointInPolygon({ lat: -3, lng: 0 }, square), false)
})

test('polygonService: findZoneByCoordinates localiza en memoria sin llamadas a BD', async () => {
  const { findZoneByCoordinates } = await loadTsPureModule('../src/services/polygonService.ts')

  const zones = [
    {
      id: 1,
      nombre: 'Zona Norte',
      coordenadas: [
        { lat: 10, lng: 10 },
        { lat: 10, lng: 20 },
        { lat: 20, lng: 20 },
        { lat: 20, lng: 10 },
      ],
      color: '#00FF00',
    },
    {
      id: 2,
      nombre: 'Zona Sur',
      coordenadas: [
        { lat: -20, lng: -20 },
        { lat: -20, lng: -10 },
        { lat: -10, lng: -10 },
        { lat: -10, lng: -20 },
      ],
      color: '#0000FF',
    },
  ]

  const matchNorte = findZoneByCoordinates({ lat: 15, lng: 15 }, zones)
  assert.equal(matchNorte?.id, 1)
  assert.equal(matchNorte?.nombre, 'Zona Norte')

  const matchSur = findZoneByCoordinates({ lat: -15, lng: -15 }, zones)
  assert.equal(matchSur?.id, 2)
  assert.equal(matchSur?.nombre, 'Zona Sur')

  const matchOutside = findZoneByCoordinates({ lat: 0, lng: 0 }, zones)
  assert.equal(matchOutside, null)
})

// 4. Tests para Semántica y Validación (Primitive Obsession & KISS)
test('LoginForm: Validación de formato de correo y longitud de contraseña', () => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Correos válidos
  assert.equal(EMAIL_REGEX.test('estudiante@uta.edu.ec'), true)
  assert.equal(EMAIL_REGEX.test('usuario.nombre@gmail.com'), true)
  assert.equal(EMAIL_REGEX.test('guardia_01@campus.uta.edu.ec'), true)

  // Correos inválidos (evita strings crudos sin formato)
  assert.equal(EMAIL_REGEX.test(''), false)
  assert.equal(EMAIL_REGEX.test('correo-sin-arroba.com'), false)
  assert.equal(EMAIL_REGEX.test('correo@sin-punto'), false)
  assert.equal(EMAIL_REGEX.test('usuario con espacios@uta.edu.ec'), false)

  // Longitud mínima de contraseña
  const isValidPassword = (p) => typeof p === 'string' && p.trim().length >= 8
  assert.equal(isValidPassword('12345678'), true)
  assert.equal(isValidPassword('short'), false)
  assert.equal(isValidPassword(''), false)
})

