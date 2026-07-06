(function () {
  if (window.location.hostname === '127.0.0.1' && !window.location.pathname.startsWith('/mock-ai')) {
    return
  }

  const INGEST_URL = 'http://127.0.0.1:3000/api/ingest'
  const STATUS_URL = 'http://127.0.0.1:3000/api/capture-status'
  const MIN_TEXT_LENGTH = 8
  const ENABLE_AUTO_PAIR_CAPTURE = false
  const ENABLE_NETWORK_PAIR_CAPTURE = false
  const INPUT_DIAGNOSTIC_INTERVAL_MS = 2500
  const sent = new Set()
  const promptSent = new Set()
  const networkSeen = new Set()
  let recentPrompt = ''
  let lastInputText = ''
  let lastInputAt = 0
  let clearCheckTimer = null
  let lastInputDiagnosticAt = 0

  function surfaceFromLocation() {
    const host = window.location.hostname
    if (host.includes('chatgpt') || host.includes('openai')) return 'ChatGPT'
    if (host.includes('claude')) return 'Claude'
    if (host.includes('cursor')) return 'Cursor'
    if (host.includes('openclaw')) return 'OpenClaw'
    return host.replace(/^www\./, '')
  }

  async function sendDiagnostic(type, message, captureMethod) {
    try {
      await fetch(STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          captureMethod,
          surface: surfaceFromLocation(),
          url: window.location.href,
        }),
      })
    } catch {
      // Diagnostics are best effort.
    }
  }

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim()
  }

  function elementFromTarget(target) {
    if (!target) return null
    if (target.nodeType === Node.ELEMENT_NODE) return target
    return target.parentElement || null
  }

  function promptElementFromTarget(target) {
    const element = elementFromTarget(target)
    if (!element) return null
    const direct = isEditablePromptElement(element) ? element : null
    if (direct) return direct
    return element.closest?.('textarea, [contenteditable="true"], [role="textbox"], [data-testid*="prompt"], [data-testid*="composer"], #prompt-textarea') || null
  }

  function isEditablePromptElement(element) {
    if (!element || element.closest?.('form[action*="login"], [type="password"]')) return false
    const tagName = element.tagName?.toLowerCase()
    const role = element.getAttribute?.('role') || ''
    const aria = element.getAttribute?.('aria-label') || ''
    const placeholder = element.getAttribute?.('placeholder') || ''
    const testId = element.getAttribute?.('data-testid') || ''
    const combined = `${role} ${aria} ${placeholder} ${testId} ${element.id || ''} ${element.className || ''}`.toLowerCase()

    if (tagName === 'textarea') return true
    if (element.isContentEditable) return true
    if (combined.includes('textbox')) return true
    if (combined.includes('prompt') || combined.includes('composer')) return true
    return false
  }

  function promptInputs() {
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[data-testid*="prompt"]',
      '[data-testid*="composer"]',
      '#prompt-textarea',
    ]

    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(isVisible)
      .filter(isEditablePromptElement)
  }

  function readPromptInput(element) {
    if (!element) return ''
    if ('value' in element && typeof element.value === 'string') return cleanText(element.value)
    return cleanText(element.innerText || element.textContent || '')
  }

  function activePromptText() {
    const active = promptElementFromTarget(document.activeElement)
    if (active && isEditablePromptElement(active)) {
      const text = readPromptInput(active)
      if (text) return text
    }

    const inputs = promptInputs()
    const withText = inputs
      .map((element) => readPromptInput(element))
      .filter((text) => text.length >= MIN_TEXT_LENGTH)
    return withText[withText.length - 1] || ''
  }

  function rememberPromptInput(text) {
    const cleaned = cleanText(text)
    if (cleaned.length < MIN_TEXT_LENGTH) return
    lastInputText = cleaned
    lastInputAt = Date.now()
    recentPrompt = cleaned
  }

  function rememberPromptElement(element) {
    const promptElement = promptElementFromTarget(element)
    if (!promptElement || !isEditablePromptElement(promptElement)) return false
    const text = readPromptInput(promptElement)
    rememberPromptInput(text)
    return text.length >= MIN_TEXT_LENGTH
  }

  function isLikelySendButton(element) {
    const button = element?.closest?.('button, [role="button"]')
    if (!button || !isVisible(button)) return false
    const attrs = [
      button.getAttribute('aria-label'),
      button.getAttribute('data-testid'),
      button.getAttribute('title'),
      button.id,
      button.className,
      button.textContent,
    ].join(' ').toLowerCase()

    const containsPromptInput = Boolean(button.closest('form, [data-testid*="composer"], main')?.querySelector?.('textarea, [contenteditable="true"], [role="textbox"], #prompt-textarea'))
    const isSubmitLike = button.getAttribute('type') === 'submit' || containsPromptInput
    const isStopButton = attrs.includes('stop') || attrs.includes('停止') || attrs.includes('cancel')

    return !isStopButton && (
      attrs.includes('send') ||
      attrs.includes('submit') ||
      attrs.includes('发送') ||
      attrs.includes('submit message') ||
      attrs.includes('send message') ||
      attrs.includes('composer-send') ||
      attrs.includes('send-button') ||
      isSubmitLike
    )
  }

  async function sendPromptOnly(userInput, trigger = 'submit') {
    const cleaned = cleanText(userInput)
    if (cleaned.length < MIN_TEXT_LENGTH) return false
    const key = `${surfaceFromLocation()}|${cleaned.slice(0, 240)}`
    if (promptSent.has(key)) return false
    promptSent.add(key)

    try {
      await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: surfaceFromLocation(),
          userInput: cleaned,
          aiOutput: 'Prompt captured at submit time. AI response not captured yet.',
          url: window.location.href,
          source: 'extension',
          captureMethod: 'dom',
          transport: 'input-listener',
          rawRequest: cleaned,
          rawResponse: '',
        }),
      })
      sendDiagnostic('ingest-success', `Captured prompt from ${trigger}`, 'dom')
      return true
    } catch (error) {
      console.debug('[AI Memory Atlas] local ingest unavailable', error)
      sendDiagnostic('ingest-error', 'Local ingest API unavailable for prompt capture', 'dom')
      return false
    }
  }

  function sendInputDiagnosticThrottled() {
    const now = Date.now()
    if (now - lastInputDiagnosticAt < INPUT_DIAGNOSTIC_INTERVAL_MS) return
    lastInputDiagnosticAt = now
    sendDiagnostic('dom-scan', 'Detected text in AI prompt input', 'dom')
  }

  function captureCurrentPrompt(trigger) {
    const candidate = activePromptText() || (Date.now() - lastInputAt < 3000 ? lastInputText : '')
    if (!candidate) return false
    sendPromptOnly(candidate, trigger)
    return true
  }

  function promptInputIsEmpty() {
    return promptInputs().every((element) => readPromptInput(element).length < MIN_TEXT_LENGTH)
  }

  function scheduleClearSubmitCheck(trigger) {
    window.clearTimeout(clearCheckTimer)
    clearCheckTimer = window.setTimeout(() => {
      if (!lastInputText || Date.now() - lastInputAt > 8000) return
      if (!promptInputIsEmpty()) return
      sendPromptOnly(lastInputText, `${trigger}-input-cleared`)
    }, 450)
  }

  function tryJson(text) {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  function collectStrings(value, strings = []) {
    if (!value) return strings
    if (typeof value === 'string') {
      const text = cleanText(value)
      if (text.length >= MIN_TEXT_LENGTH) strings.push(text)
      return strings
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collectStrings(item, strings))
      return strings
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => {
        const lowered = key.toLowerCase()
        if (
          lowered.includes('content') ||
          lowered.includes('text') ||
          lowered.includes('prompt') ||
          lowered.includes('message') ||
          lowered.includes('query')
        ) {
          collectStrings(item, strings)
        } else if (typeof item === 'object') {
          collectStrings(item, strings)
        }
      })
    }
    return strings
  }

  function parseSseText(text) {
    const chunks = []
    String(text || '').split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) return
      const payload = trimmed.replace(/^data:\s*/, '')
      if (!payload || payload === '[DONE]') return
      const parsed = tryJson(payload)
      if (parsed) {
        collectStrings(parsed, chunks)
      } else {
        chunks.push(payload)
      }
    })
    return cleanText(chunks.join(' '))
  }

  function extractPromptFromRequest(requestBody) {
    const parsed = tryJson(requestBody)
    if (parsed) {
      const strings = collectStrings(parsed)
      return strings[strings.length - 1] || strings[0] || ''
    }
    return cleanText(requestBody)
  }

  function extractAnswerFromResponse(responseText) {
    const parsed = tryJson(responseText)
    if (parsed) {
      const strings = collectStrings(parsed)
      return strings.slice(-4).join(' ')
    }
    const sse = parseSseText(responseText)
    if (sse) return sse
    return cleanText(responseText)
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function textFromElement(element) {
    const clone = element.cloneNode(true)
    clone.querySelectorAll('button, svg, nav, aside, style, script').forEach((node) => node.remove())
    return cleanText(clone.innerText || clone.textContent || '')
  }

  function roleOf(element) {
    const attrs = [
      element.getAttribute('data-message-author-role'),
      element.getAttribute('data-testid'),
      element.getAttribute('aria-label'),
      element.className,
    ].join(' ').toLowerCase()

    if (attrs.includes('user') || attrs.includes('human')) return 'user'
    if (attrs.includes('assistant') || attrs.includes('model') || attrs.includes('bot')) return 'assistant'
    return null
  }

  function candidateMessages() {
    const selectors = [
      '[data-message-author-role]',
      '[data-testid*="conversation-turn"]',
      '[data-testid*="message"]',
      '.group\\/conversation-turn',
      '.font-claude-message',
      'article',
      '[role="article"]',
    ]

    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(isVisible)
      .map((element) => ({ element, role: roleOf(element), text: textFromElement(element) }))
      .filter((item) => item.text.length >= MIN_TEXT_LENGTH)
  }

  function inferPairs() {
    const candidates = candidateMessages()
    const roleAware = candidates.filter((item) => item.role)
    const pairs = []

    for (let index = 0; index < roleAware.length - 1; index += 1) {
      const current = roleAware[index]
      const next = roleAware[index + 1]
      if (current.role === 'user' && next.role === 'assistant') {
        pairs.push({ userInput: current.text, aiOutput: next.text })
      }
    }

    if (pairs.length > 0) return pairs

    // Fallback for unknown AI UIs: pair the last two substantial blocks.
    const unique = []
    for (const item of candidates) {
      if (!unique.some((seen) => seen.text === item.text)) unique.push(item)
    }
    if (unique.length >= 2) {
      const lastTwo = unique.slice(-2)
      return [{ userInput: lastTwo[0].text, aiOutput: lastTwo[1].text }]
    }

    return []
  }

  async function sendPair(pair) {
    const key = `${pair.userInput.slice(0, 160)}|${pair.aiOutput.slice(0, 160)}`
    if (sent.has(key)) return
    sent.add(key)

    try {
      await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: surfaceFromLocation(),
          userInput: pair.userInput,
          aiOutput: pair.aiOutput,
          url: window.location.href,
          source: 'extension',
          captureMethod: pair.captureMethod || 'dom',
          transport: pair.transport || pair.captureMethod || 'dom',
          rawRequest: pair.rawRequest || pair.userInput,
          rawResponse: pair.rawResponse || pair.aiOutput,
        }),
      })
      sendDiagnostic('ingest-success', `Captured ${pair.captureMethod || 'dom'} pair`, pair.captureMethod || 'dom')
    } catch (error) {
      console.debug('[Second Brain] local ingest unavailable', error)
      sendDiagnostic('ingest-error', 'Local ingest API unavailable', pair.captureMethod || 'dom')
    }
  }

  function handleNetworkEvent(payload) {
    if (!payload) return
    const userInput = extractPromptFromRequest(payload.requestBody) || recentPrompt
    const aiOutput = extractAnswerFromResponse(payload.responseText)

    if (payload.requestBody && userInput.length >= MIN_TEXT_LENGTH) {
      recentPrompt = userInput
    }

    if (!payload.responseText || aiOutput.length < MIN_TEXT_LENGTH) {
      if (payload.requestBody && ENABLE_NETWORK_PAIR_CAPTURE) {
        sendDiagnostic('network-event', `Network hook saw ${payload.transport || 'request'} prompt`, 'network')
      }
      return
    }

    if (!ENABLE_NETWORK_PAIR_CAPTURE) return

    if (userInput.length < MIN_TEXT_LENGTH || aiOutput.length < MIN_TEXT_LENGTH) return

    const key = `${payload.url}|${userInput.slice(0, 160)}|${aiOutput.slice(0, 160)}`
    if (networkSeen.has(key)) return
    networkSeen.add(key)

    sendPair({
      userInput,
      aiOutput,
      captureMethod: 'network',
      transport: payload.transport,
      rawRequest: payload.requestBody,
      rawResponse: payload.responseText,
    })
    sendDiagnostic('network-event', `Network hook saw ${payload.transport || 'request'} ${payload.status || ''}`, 'network')
  }

  let scanTimer = null
  function captureDomPairsNow() {
    const pairs = inferPairs().slice(-3)
    if (pairs.length > 0) {
      sendDiagnostic('dom-scan', `DOM scan found ${pairs.length} candidate pair(s)`, 'dom')
    }
    pairs.forEach(sendPair)
    return pairs.length
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer)
    scanTimer = window.setTimeout(() => {
      scheduleClearSubmitCheck('mutation')
      if (ENABLE_AUTO_PAIR_CAPTURE) captureDomPairsNow()
    }, 900)
  }

  sendDiagnostic('heartbeat', 'AI Memory Atlas extension content script loaded')
  document.addEventListener('input', (event) => {
    if (!rememberPromptElement(event.target)) return
    sendInputDiagnosticThrottled()
  }, true)

  document.addEventListener('keydown', (event) => {
    if (!rememberPromptElement(event.target)) return
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    captureCurrentPrompt('enter-submit')
    scheduleClearSubmitCheck('enter-submit')
  }, true)

  document.addEventListener('keyup', (event) => {
    if (event.key !== 'Enter') return
    scheduleClearSubmitCheck('enter-keyup')
  }, true)

  function captureBeforeSendClick(event, trigger) {
    if (!isLikelySendButton(event.target)) return
    const candidate = activePromptText() || lastInputText
    if (candidate) rememberPromptInput(candidate)
    captureCurrentPrompt(trigger)
    scheduleClearSubmitCheck(trigger)
  }

  document.addEventListener('pointerdown', (event) => captureBeforeSendClick(event, 'send-button'), true)
  document.addEventListener('mousedown', (event) => captureBeforeSendClick(event, 'send-button'), true)
  document.addEventListener('click', (event) => captureBeforeSendClick(event, 'send-button'), true)

  document.addEventListener('submit', (event) => {
    rememberPromptElement(event.target)
    captureCurrentPrompt('form-submit')
    scheduleClearSubmitCheck('form-submit')
  }, true)

  scheduleScan()
  const observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.type !== 'SECOND_BRAIN_NETWORK_EVENT') return
    handleNetworkEvent(event.data.payload)
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SECOND_BRAIN_CAPTURE_NOW') return false
    const pairCount = ENABLE_AUTO_PAIR_CAPTURE ? captureDomPairsNow() : 0
    const promptCaptured = captureCurrentPrompt('manual-popup')
    sendResponse({
      ok: true,
      pairCount,
      promptCaptured,
      message: pairCount > 0 || promptCaptured ? 'Captured available page context.' : 'No prompt or DOM pairs found on this page.',
    })
    return false
  })
})()
