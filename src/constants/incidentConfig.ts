import type { IncidentConfig } from '../types/incident'

export const DEFAULT_INCIDENT_CONFIG: IncidentConfig = {
  label: 'Otro',
  color: '#666666',
  emoji: '⚠️',
  severity: 'low',
}

/**
 * Open-Closed Principle (OCP) Registry:
 * Centralized registry for incident types, display labels, visual colors, and emojis.
 * To register a new emergency (e.g., 'fuga_gas'), extend this registry
 * without modifying IncidentMap or consumer components.
 */
export const INCIDENT_CONFIG_REGISTRY: Record<string, IncidentConfig> = {
  robo: {
    label: 'Robo',
    color: '#FF0000',
    emoji: '🔓',
    severity: 'high',
  },
  agresion: {
    label: 'Agresión',
    color: '#FF6600',
    emoji: '⚠️',
    severity: 'high',
  },
  vandalismo: {
    label: 'Vandalismo',
    color: '#FFAA00',
    emoji: '🔨',
    severity: 'medium',
  },
  sospechoso: {
    label: 'Sospechoso',
    color: '#9900FF',
    emoji: '👁️',
    severity: 'medium',
  },
  accidente: {
    label: 'Accidente',
    color: '#0066FF',
    emoji: '🚨',
    severity: 'high',
  },
  incendio: {
    label: 'Incendio',
    color: '#FF3300',
    emoji: '🔥',
    severity: 'high',
  },
  fuga_gas: {
    label: 'Fuga de Gas',
    color: '#E65100',
    emoji: '⛽',
    severity: 'high',
  },
  otro: DEFAULT_INCIDENT_CONFIG,
}

/**
 * Retrieves the complete configuration object for an incident type.
 * Falls back to DEFAULT_INCIDENT_CONFIG if the type is unmapped.
 */
export const getIncidentConfig = (tipo?: string | null): IncidentConfig => {
  if (!tipo) return DEFAULT_INCIDENT_CONFIG
  const normalized = tipo.toLowerCase().trim()
  return INCIDENT_CONFIG_REGISTRY[normalized] || DEFAULT_INCIDENT_CONFIG
}

/**
 * Retrieves the marker/display color for an incident type based on the registry.
 */
export const getIncidentColor = (tipo?: string | null): string => {
  return getIncidentConfig(tipo).color
}
