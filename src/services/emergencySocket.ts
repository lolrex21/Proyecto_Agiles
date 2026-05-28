type SocketRole = 'guard' | 'affected'

type SocketMessage = {
  type: string
  [key: string]: any
}

type SocketListener = (message: SocketMessage) => void

class EmergencySocket {
  private socket: WebSocket | null = null
  private listeners: SocketListener[] = []
  private pendingMessages: SocketMessage[] = []
  private reconnectAttempts = 0
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private currentRole: SocketRole | null = null
  private currentUserId: string | null = null

  private readonly maxReconnectAttempts = 5
  private readonly reconnectDelay = 2000

  connect(role: SocketRole, userId: string) {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

    this.currentRole = role
    this.currentUserId = userId

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.socket = new WebSocket(wsUrl)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0

      this.sendNow({
        type: 'REGISTER',
        role,
        userId,
      })

      this.flushPendingMessages()
    }

    this.socket.onmessage = (event) => {
      const message = this.parseMessage(event.data)

      if (!message) return

      this.listeners.forEach((listener) => {
        listener(message)
      })
    }

    this.socket.onclose = () => {
      this.socket = null
      this.tryReconnect()
    }

    this.socket.onerror = () => {
      this.socket?.close()
    }
  }

  send(payload: SocketMessage) {
    if (!this.isOpen()) {
      this.pendingMessages.push(payload)
      this.ensureConnection()
      return
    }

    this.sendNow(payload)
  }

  subscribe(listener: SocketListener) {
    this.listeners.push(listener)

    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  createIncident(incident: any) {
    this.send({
      type: 'INCIDENT_CREATED',
      incident,
    })
  }

  takeIncident(incidentId: string, guardId: string, incident?: any) {
    this.send({
      type: 'TAKE_INCIDENT',
      incidentId,
      guardId,
      incident,
    })
  }

  updateIncident(incidentId: string, status: 'Atendido' | 'Cerrado', guardId?: string) {
    this.send({
      type: 'INCIDENT_UPDATED',
      incidentId,
      status,
      guardId,
    })
  }

  closeIncident(
    incidentId: string,
    guardId: string,
    description: string,
    incident?: any
  ) {
    this.send({
      type: 'CLOSE_INCIDENT',
      incidentId,
      guardId,
      description,
      incident,
    })
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.pendingMessages = []
    this.listeners = []
    this.reconnectAttempts = 0
    this.currentRole = null
    this.currentUserId = null

    this.socket?.close()
    this.socket = null
  }

  private isOpen() {
    return this.socket?.readyState === WebSocket.OPEN
  }

  private sendNow(payload: SocketMessage) {
    this.socket?.send(JSON.stringify(payload))
  }

  private flushPendingMessages() {
    while (this.pendingMessages.length > 0 && this.isOpen()) {
      const message = this.pendingMessages.shift()

      if (message) {
        this.sendNow(message)
      }
    }
  }

  private ensureConnection() {
    if (!this.currentRole || !this.currentUserId) return

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.connect(this.currentRole, this.currentUserId)
  }

  private tryReconnect() {
    if (!this.currentRole || !this.currentUserId) return

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++

    this.reconnectTimeout = setTimeout(() => {
      if (this.currentRole && this.currentUserId) {
        this.connect(this.currentRole, this.currentUserId)
      }
    }, this.reconnectDelay)
  }

  private parseMessage(data: string) {
    try {
      return JSON.parse(data) as SocketMessage
    } catch {
      return null
    }
  }
}

export const emergencySocket = new EmergencySocket()