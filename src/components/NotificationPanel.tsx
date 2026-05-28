import type { GeneralNotification, GroupNotification, GroupRequest } from '../types/trustGroup'

interface NotificationPanelProps {
  pendingInvites: GroupRequest[]
  generalNotifications: GeneralNotification[]
  groupNotifications: GroupNotification[]
  onClose: () => void
  onRespondInvite: (requestId: number, accept: boolean) => Promise<void>
  onMarkGeneralRead: (notificationId: number) => Promise<void>
  onMarkGroupRead: (notificationId: number) => Promise<void>
}

export default function NotificationPanel({
  pendingInvites,
  generalNotifications,
  groupNotifications,
  onClose,
  onRespondInvite,
  onMarkGeneralRead,
  onMarkGroupRead,
}: NotificationPanelProps) {
  return (
<div className="
  fixed left-1/2 top-20 z-[9999]
  w-[92vw] max-w-[360px]
  -translate-x-1/2
  rounded-2xl border border-gray-200 bg-white
  shadow-2xl overflow-hidden
  sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-3 sm:w-96 sm:max-w-[90vw] sm:translate-x-0
">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-uta-navy">Notificaciones</p>
          <p className="text-xs text-gray-500">Actualizado en tiempo real</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-uta-navy">
          Cerrar
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto space-y-4 p-4">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-uta-navy">Solicitudes de Grupo</h3>
            <span className="text-xs text-gray-500">{pendingInvites.length} pendientes</span>
          </div>

          {pendingInvites.length === 0 ? (
            <p className="text-xs text-gray-500">No hay invitaciones pendientes.</p>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-uta-navy whitespace-normal break-words">
                    Invitación al grupo {invite.grupo_nombre || invite.grupo_id}
                  </p>

                  <p className="text-xs text-gray-600">
                    De: {invite.solicitante_nombre || 'Administrador'} • {new Date(invite.created_at).toLocaleString('es-ES')}
                  </p>

                  {invite.mensaje && (
                    <p className="text-sm text-gray-700 mt-2 whitespace-normal break-words">
                      {invite.mensaje}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => await onRespondInvite(Number(invite.id), true)}
                      className="flex-1 rounded-lg bg-uta-gold px-3 py-2 text-xs font-semibold text-uta-navy transition hover:bg-uta-gold-dark"
                    >
                      Aceptar
                    </button>

                    <button
                      type="button"
                      onClick={async () => await onRespondInvite(Number(invite.id), false)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-uta-navy">Alertas de Incidente</h3>
            <span className="text-xs text-gray-500">{generalNotifications.length}</span>
          </div>

          {generalNotifications.length === 0 ? (
            <p className="text-xs text-gray-500">No hay alertas nuevas.</p>
          ) : (
            <div className="space-y-3">
              {generalNotifications.map(item => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-uta-navy whitespace-normal break-words">
                        {item.mensaje}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.fecha).toLocaleString('es-ES')}
                      </p>
                    </div>

                    {!item.leido && (
                      <button
                        type="button"
                        onClick={async () => await onMarkGeneralRead(Number(item.id))}
                        className="shrink-0 text-xs font-semibold text-uta-gold"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-uta-navy">Notificaciones de Grupo</h3>
            <span className="text-xs text-gray-500">{groupNotifications.length}</span>
          </div>

          {groupNotifications.length === 0 ? (
            <p className="text-xs text-gray-500">No hay notificaciones de grupo nuevas.</p>
          ) : (
            <div className="space-y-3">
              {groupNotifications.map(item => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-uta-navy whitespace-normal break-words">
                        {item.mensaje}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>

                    {!item.leida && (
                      <button
                        type="button"
                        onClick={async () => {
                          console.log('Marcando notificación de grupo:', item.id)
                          await onMarkGroupRead(Number(item.id))
                        }}
                        className="shrink-0 text-xs font-semibold text-uta-gold"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}   