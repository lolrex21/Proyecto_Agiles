import { useState } from 'react'
import { confirmAttendance } from '../../services/incidentGuardService'

interface ConfirmAttendanceButtonProps {
  incidentId: number
  guardId: number
  isAlreadyAssigned: boolean
  onConfirm: () => void
}

export default function ConfirmAttendanceButton({
  incidentId,
  guardId,
  isAlreadyAssigned,
  onConfirm,
}: ConfirmAttendanceButtonProps) {
  const [submitting, setSubmitting] = useState(false)

  if (isAlreadyAssigned) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-sm font-semibold text-green-700">Asistencia confirmada</span>
      </div>
    )
  }

  const handleClick = async () => {
    setSubmitting(true)
    const success = await confirmAttendance(incidentId, guardId)
    setSubmitting(false)

    if (success) {
      onConfirm()
    } else {
      alert('No se pudo confirmar tu asistencia. Intenta nuevamente.')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={submitting}
      className="w-full py-2.5 px-4 bg-uta-navy hover:bg-uta-navy/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
      {submitting ? 'Confirmando...' : 'Confirmar Asistencia'}
    </button>
  )
}
