import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 3001
const wss = new WebSocketServer({ port: PORT })

const clients = new Map()

function send(client, payload) {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(payload))
  }
}

function broadcast(payload, filterFn) {
  for (const [client, meta] of clients.entries()) {
    if (!filterFn || filterFn(meta)) {
      send(client, payload)
    }
  }
}

function sendToGuards(payload) {
  broadcast(payload, (meta) => meta.role === 'guard')
}

function registerClient(ws, message) {
  const { role, userId } = message

  if (!role || !userId) {
    send(ws, {
      type: 'ERROR',
      message: 'REGISTER requiere role y userId',
    })
    return
  }

  if (!['guard', 'affected'].includes(role)) {
    send(ws, {
      type: 'ERROR',
      message: 'Rol no válido',
    })
    return
  }

  clients.set(ws, { role, userId })

  send(ws, {
    type: 'REGISTERED',
    role,
    userId,
  })
}

function handleIncidentCreated(ws, message) {
  const { incident } = message

  if (!incident || !incident.id) {
    send(ws, {
      type: 'ERROR',
      message: 'INCIDENT_CREATED requiere un incidente con id',
    })
    return
  }

  sendToGuards({
    type: 'NEW_INCIDENT',
    incident,
  })
}

function handleIncidentTaken(ws, message) {
  const meta = clients.get(ws)
  const { incidentId, guardId, incident } = message

  if (!meta || meta.role !== 'guard') {
    send(ws, {
      type: 'ERROR',
      message: 'Solo un guardia puede tomar alertas',
    })
    return
  }

  if (!incidentId || !guardId) {
    send(ws, {
      type: 'ERROR',
      message: 'TAKE_INCIDENT requiere incidentId y guardId',
    })
    return
  }

  broadcast({
    type: 'INCIDENT_TAKEN',
    incidentId,
    guardId,
    incident,
  })
}

function handleIncidentClosed(ws, message) {
  const meta = clients.get(ws)
  const { incidentId, guardId, description, incident } = message

  if (!meta || meta.role !== 'guard') {
    send(ws, {
      type: 'ERROR',
      message: 'Solo un guardia puede cerrar alertas',
    })
    return
  }

  if (!incidentId || !guardId) {
    send(ws, {
      type: 'ERROR',
      message: 'CLOSE_INCIDENT requiere incidentId y guardId',
    })
    return
  }

  broadcast({
    type: 'INCIDENT_CLOSED',
    incidentId,
    guardId,
    description,
    incident,
  })
}

wss.on('connection', (ws) => {
  send(ws, {
    type: 'CONNECTED',
  })

  ws.on('message', (rawMessage) => {
    let message

    try {
      message = JSON.parse(rawMessage.toString())
    } catch {
      send(ws, {
        type: 'ERROR',
        message: 'Formato de mensaje inválido',
      })
      return
    }

    switch (message.type) {
      case 'REGISTER':
        registerClient(ws, message)
        break

      case 'INCIDENT_CREATED':
        handleIncidentCreated(ws, message)
        break

      case 'TAKE_INCIDENT':
        handleIncidentTaken(ws, message)
        break

      case 'CLOSE_INCIDENT':
        handleIncidentClosed(ws, message)
        break

      default:
        send(ws, {
          type: 'ERROR',
          message: `Tipo de mensaje no soportado: ${message.type}`,
        })
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
  })

  ws.on('error', () => {
    clients.delete(ws)
  })
})

console.log(`Servidor WebSocket escuchando en ws://localhost:${PORT}`)