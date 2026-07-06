(function () {
  if (window.location.hostname === '127.0.0.1' && !window.location.pathname.startsWith('/mock-ai')) {
    return
  }

  const MAX_CAPTURE_CHARS = 24000
  const MESSAGE_TYPE = 'SECOND_BRAIN_NETWORK_EVENT'
  const AI_ENDPOINT_HINTS = [
    'conversation',
    'completion',
    'messages',
    'chat',
    'claude',
    'openai',
    'backend-api',
    'api/',
    'stream',
    'socket',
    'ws',
  ]

  function shouldCaptureUrl(url) {
    const text = String(url || '').toLowerCase()
    return AI_ENDPOINT_HINTS.some((hint) => text.includes(hint))
  }

  function truncate(text) {
    return String(text || '').slice(0, MAX_CAPTURE_CHARS)
  }

  function bodyToText(body) {
    if (!body) return ''
    if (typeof body === 'string') return body
    if (body instanceof URLSearchParams) return body.toString()
    if (body instanceof FormData) {
      const values = []
      body.forEach((value, key) => {
        if (typeof value === 'string') values.push(`${key}: ${value}`)
      })
      return values.join('\n')
    }
    try {
      return JSON.stringify(body)
    } catch {
      return ''
    }
  }

  function emit(payload) {
    window.postMessage({
      type: MESSAGE_TYPE,
      payload: {
        ...payload,
        pageUrl: window.location.href,
        capturedAt: Date.now(),
      },
    }, '*')
  }

  const originalFetch = window.fetch
  if (typeof originalFetch === 'function') {
    window.fetch = async function secondBrainFetch(input, init) {
      const url = typeof input === 'string' ? input : input && input.url
      const method = (init && init.method) || (input && input.method) || 'GET'
      const requestBody = init && init.body ? bodyToText(init.body) : ''
      const response = await originalFetch.apply(this, arguments)

      if (shouldCaptureUrl(url) && method.toUpperCase() !== 'GET') {
        response.clone().text().then((responseText) => {
          emit({
            transport: 'fetch',
            url: String(url || ''),
            method,
            requestBody: truncate(requestBody),
            responseText: truncate(responseText),
            status: response.status,
          })
        }).catch(() => {
          emit({
            transport: 'fetch',
            url: String(url || ''),
            method,
            requestBody: truncate(requestBody),
            responseText: '',
            status: response.status,
          })
        })
      }

      return response
    }
  }

  const OriginalXHR = window.XMLHttpRequest
  if (typeof OriginalXHR === 'function') {
    const originalOpen = OriginalXHR.prototype.open
    const originalSend = OriginalXHR.prototype.send

    OriginalXHR.prototype.open = function secondBrainOpen(method, url) {
      this.__secondBrain = { method, url }
      return originalOpen.apply(this, arguments)
    }

    OriginalXHR.prototype.send = function secondBrainSend(body) {
      const meta = this.__secondBrain || {}
      const requestBody = bodyToText(body)

      this.addEventListener('loadend', function () {
        if (!shouldCaptureUrl(meta.url) || String(meta.method || 'GET').toUpperCase() === 'GET') return
        emit({
          transport: 'xhr',
          url: String(meta.url || ''),
          method: meta.method || 'POST',
          requestBody: truncate(requestBody),
          responseText: truncate(this.responseText || ''),
          status: this.status,
        })
      })

      return originalSend.apply(this, arguments)
    }
  }

  const OriginalEventSource = window.EventSource
  if (typeof OriginalEventSource === 'function') {
    window.EventSource = function secondBrainEventSource(url, config) {
      const source = new OriginalEventSource(url, config)
      if (shouldCaptureUrl(url)) {
        source.addEventListener('message', (event) => {
          emit({
            transport: 'eventsource',
            url: String(url || ''),
            method: 'EVENTSOURCE',
            requestBody: '',
            responseText: truncate(event.data || ''),
            status: 200,
          })
        })
      }
      return source
    }
    window.EventSource.prototype = OriginalEventSource.prototype
  }

  const OriginalWebSocket = window.WebSocket
  if (typeof OriginalWebSocket === 'function') {
    window.WebSocket = function secondBrainWebSocket(url, protocols) {
      const socket = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url)
      const shouldCapture = shouldCaptureUrl(url)

      if (shouldCapture) {
        const originalSend = socket.send
        socket.send = function secondBrainSocketSend(data) {
          emit({
            transport: 'websocket',
            url: String(url || ''),
            method: 'WEBSOCKET_SEND',
            requestBody: truncate(bodyToText(data)),
            responseText: '',
            status: 0,
          })
          return originalSend.apply(this, arguments)
        }

        socket.addEventListener('message', (event) => {
          emit({
            transport: 'websocket',
            url: String(url || ''),
            method: 'WEBSOCKET_MESSAGE',
            requestBody: '',
            responseText: truncate(typeof event.data === 'string' ? event.data : ''),
            status: 0,
          })
        })
      }

      return socket
    }
    window.WebSocket.prototype = OriginalWebSocket.prototype
  }
})()
