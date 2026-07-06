const APP_URL = 'http://127.0.0.1:3000'
const statusEl = document.getElementById('status')
const testButton = document.getElementById('test')
const captureButton = document.getElementById('capture')
const openButton = document.getElementById('open')

function setStatus(message, tone = 'ok') {
  statusEl.className = `status ${tone === 'ok' ? '' : tone}`.trim()
  statusEl.textContent = message
}

async function testLocalApp() {
  try {
    const response = await fetch(`${APP_URL}/api/events`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    setStatus(`Connected. ${data.events?.length || 0} captured event(s) in local atlas.`)
  } catch (error) {
    setStatus(`Cannot reach ${APP_URL}. Start npm run dev in the project folder.`, 'bad')
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function captureCurrentPage() {
  const tab = await getActiveTab()
  if (!tab?.id) {
    setStatus('No active tab found.', 'bad')
    return
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SECOND_BRAIN_CAPTURE_NOW' })
    if (response?.ok) {
      setStatus(`Capture requested. Prompt: ${response.promptCaptured ? 'yes' : 'no'}, DOM pairs: ${response.pairCount || 0}.`)
    } else {
      setStatus(response?.message || 'Content script did not return a capture result.', 'warn')
    }
  } catch (error) {
    setStatus('This page is not covered by the extension. Open a supported AI page or /mock-ai.', 'warn')
  }
}

testButton.addEventListener('click', testLocalApp)
captureButton.addEventListener('click', captureCurrentPage)
openButton.addEventListener('click', () => chrome.tabs.create({ url: APP_URL }))

testLocalApp()
