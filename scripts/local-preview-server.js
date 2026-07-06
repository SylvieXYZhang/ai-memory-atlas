const http = require('http')
const fs = require('fs')
const path = require('path')

const host = '127.0.0.1'
const port = Number(process.env.PORT || 3000)
const dataDir = path.join(process.cwd(), '.second-brain')
const dataFile = path.join(dataDir, 'preview-events.json')

function readEvents() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  } catch {
    return []
  }
}

function writeEvents(events) {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(dataFile, JSON.stringify(events, null, 2), 'utf8')
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(JSON.stringify(value, null, 2))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve(null)
      }
    })
  })
}

const seedNodes = [
  { id: 'project-atlas', type: 'project', title: 'AI Memory Atlas', summary: 'A visual memory system for long-term human-AI collaboration.', confidence: 0.96 },
  { id: 'idea-graph', type: 'idea', title: 'Memory Graph', summary: 'Turn scattered AI conversations into typed nodes and relationships.', confidence: 0.91 },
  { id: 'decision-review', type: 'decision', title: 'Review Before Promotion', summary: 'Captured interactions enter an inbox before becoming durable memory.', confidence: 0.88 },
  { id: 'task-capture', type: 'task', title: 'Capture Pipeline', summary: 'Manual and extension captures feed the atlas API.', confidence: 0.84 },
  { id: 'artifact-export', type: 'artifact', title: 'Agent Context Export', summary: 'Project state can be exported back into another AI workflow.', confidence: 0.82 },
]

function eventToCandidate(event) {
  return {
    id: event.id,
    eventId: event.id,
    status: event.status || 'pending',
    surface: event.surface || 'Manual',
    title: event.title || (event.userInput || 'Captured memory').slice(0, 56),
    type: event.type || 'idea',
    summary: event.summary || event.aiOutput || 'Captured from a preview interaction.',
    evidence: [event.userInput || '', event.aiOutput || ''].filter(Boolean),
    confidence: 0.76,
    createdAt: event.createdAt,
  }
}

function buildAtlas() {
  const events = readEvents()
  const candidates = events.map(eventToCandidate)
  const accepted = candidates.filter((item) => item.status === 'accepted')
  const liveNodes = accepted.map((item, index) => ({
    id: `live-${item.id}`,
    type: item.type,
    title: item.title,
    summary: item.summary,
    confidence: item.confidence,
    evidence: item.evidence,
    x: 260 + index * 90,
    y: 210 + (index % 3) * 70,
  }))

  return {
    nodes: [...seedNodes, ...liveNodes],
    edges: [
      { from: 'idea-graph', to: 'project-atlas', type: 'belongs_to' },
      { from: 'decision-review', to: 'project-atlas', type: 'supports' },
      { from: 'task-capture', to: 'project-atlas', type: 'belongs_to' },
      { from: 'artifact-export', to: 'project-atlas', type: 'generated_from' },
      ...liveNodes.map((node) => ({ from: node.id, to: 'project-atlas', type: 'generated_from' })),
    ],
    candidates,
    liveEventCount: events.length,
  }
}

function pageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Memory Atlas Preview</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #09090b; color: #f4f4f5; }
    .shell { display: grid; grid-template-columns: 340px minmax(0, 1fr); min-height: 100vh; }
    aside { border-right: 1px solid #27272a; background: #111113; padding: 22px; overflow: auto; }
    main { padding: 24px; overflow: auto; }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    p { color: #a1a1aa; line-height: 1.55; }
    .badge { display: inline-flex; margin: 12px 8px 0 0; border: 1px solid #3f3f46; border-radius: 999px; padding: 4px 9px; color: #d4d4d8; font-size: 12px; }
    .panel { border: 1px solid #27272a; background: #18181b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    label { display: block; margin-top: 12px; color: #a1a1aa; font-size: 12px; }
    input, textarea, select { box-sizing: border-box; width: 100%; margin-top: 6px; border: 1px solid #3f3f46; border-radius: 6px; background: #09090b; color: #f4f4f5; padding: 10px; font: inherit; }
    textarea { min-height: 90px; resize: vertical; }
    button { border: 0; border-radius: 6px; background: #34d399; color: #052e1b; padding: 10px 12px; font-weight: 700; cursor: pointer; }
    button.secondary { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .stat { border: 1px solid #27272a; border-radius: 8px; padding: 14px; background: #111113; }
    .stat strong { display: block; font-size: 24px; }
    .graph { position: relative; min-height: 430px; border: 1px solid #27272a; border-radius: 8px; background: radial-gradient(circle at 30% 20%, #12352c, transparent 32%), #101014; overflow: hidden; }
    .node { position: absolute; width: 172px; min-height: 74px; transform: translate(-50%, -50%); border: 1px solid #52525b; border-radius: 8px; background: rgba(24,24,27,.92); padding: 10px; box-shadow: 0 16px 40px rgba(0,0,0,.28); }
    .node strong { display: block; font-size: 13px; }
    .node span { color: #a1a1aa; font-size: 11px; }
    .node.project { border-color: #34d399; }
    .node.idea { border-color: #22d3ee; }
    .node.decision { border-color: #fbbf24; }
    .node.task { border-color: #60a5fa; }
    .node.artifact { border-color: #f472b6; }
    .candidate { border: 1px solid #3f3f46; border-radius: 8px; padding: 12px; margin-top: 10px; background: #111113; }
    .candidate.pending { border-color: #fbbf24; }
    .candidate.accepted { border-color: #34d399; }
    .candidate.rejected { opacity: .62; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, .7fr); gap: 16px; }
    @media (max-width: 900px) { .shell, .grid { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #27272a; } .stats { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <h1>AI Memory Atlas</h1>
      <p>Local fallback preview. The full Next app still needs npm registry access, but this service lets you test capture, review, and graph promotion.</p>
      <span class="badge">graph-first</span><span class="badge">review inbox</span><span class="badge">local API</span>
      <div class="panel" style="margin-top:18px">
        <h2>Capture To Atlas</h2>
        <label>Surface<input id="surface" value="ChatGPT" /></label>
        <label>User prompt<textarea id="prompt">I want captured AI chats to become memory nodes I can review.</textarea></label>
        <label>AI response<textarea id="response">Route new captures into an inbox, then promote accepted items into the memory graph.</textarea></label>
        <div class="toolbar"><button onclick="capture()">Add as candidate</button><button class="secondary" onclick="refresh()">Refresh</button></div>
      </div>
      <div class="panel">
        <h2>Candidate Inbox</h2>
        <div id="candidates"></div>
      </div>
    </aside>
    <main>
      <div class="stats">
        <div class="stat"><strong id="nodeCount">0</strong><span>Memory nodes</span></div>
        <div class="stat"><strong id="candidateCount">0</strong><span>Candidates</span></div>
        <div class="stat"><strong id="acceptedCount">0</strong><span>Accepted</span></div>
        <div class="stat"><strong id="liveCount">0</strong><span>Live captures</span></div>
      </div>
      <div class="grid" style="margin-top:16px">
        <section class="panel">
          <h2>Personal Memory Graph</h2>
          <div id="graph" class="graph"></div>
        </section>
        <section class="panel">
          <h2>Project Lens</h2>
          <p><strong>Project:</strong> AI Memory Atlas</p>
          <p><strong>Status:</strong> Prototype preview running locally.</p>
          <p><strong>Next:</strong> Enable dependency download, then run the real Next service.</p>
          <button class="secondary" onclick="copyContext()">Copy Project Context</button>
          <h2 style="margin-top:20px">Replay</h2>
          <p>1. Capture raw AI collaboration.</p>
          <p>2. Review candidate memories.</p>
          <p>3. Promote accepted memories into the graph.</p>
        </section>
      </div>
    </main>
  </div>
  <script>
    let atlas = null
    async function refresh() {
      atlas = await fetch('/api/atlas').then(r => r.json())
      document.getElementById('nodeCount').textContent = atlas.nodes.length
      document.getElementById('candidateCount').textContent = atlas.candidates.length
      document.getElementById('acceptedCount').textContent = atlas.candidates.filter(c => c.status === 'accepted').length
      document.getElementById('liveCount').textContent = atlas.liveEventCount
      renderGraph()
      renderCandidates()
    }
    function renderGraph() {
      const graph = document.getElementById('graph')
      graph.innerHTML = ''
      atlas.nodes.forEach((node, index) => {
        const el = document.createElement('div')
        el.className = 'node ' + node.type
        const x = node.x || 150 + (index % 3) * 230
        const y = node.y || 90 + Math.floor(index / 3) * 135
        el.style.left = x + 'px'
        el.style.top = y + 'px'
        el.innerHTML = '<strong>' + escapeHtml(node.title) + '</strong><span>' + node.type + ' - ' + Math.round(node.confidence * 100) + '% confidence</span><p style="font-size:11px;margin:6px 0 0">' + escapeHtml(node.summary) + '</p>'
        graph.appendChild(el)
      })
    }
    function renderCandidates() {
      const list = document.getElementById('candidates')
      list.innerHTML = atlas.candidates.length ? '' : '<p>No live captures yet.</p>'
      atlas.candidates.forEach((candidate) => {
        const el = document.createElement('div')
        el.className = 'candidate ' + candidate.status
        el.innerHTML = '<strong>' + escapeHtml(candidate.title) + '</strong><p>' + escapeHtml(candidate.summary) + '</p><span class="badge">' + candidate.status + '</span><span class="badge">' + candidate.type + '</span><div class="toolbar"><button onclick="review(\\'' + candidate.id + '\\', \\'accepted\\')">Accept</button><button class="secondary" onclick="review(\\'' + candidate.id + '\\', \\'rejected\\')">Reject</button></div>'
        list.appendChild(el)
      })
    }
    async function capture() {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          surface: document.getElementById('surface').value,
          userInput: document.getElementById('prompt').value,
          aiOutput: document.getElementById('response').value,
        })
      })
      await refresh()
    }
    async function review(id, status) {
      await fetch('/api/memory-candidates', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      await refresh()
    }
    async function copyContext() {
      const accepted = atlas.candidates.filter(c => c.status === 'accepted').map(c => '- ' + c.title + ': ' + c.summary).join('\\n')
      await navigator.clipboard.writeText('Project: AI Memory Atlas\\nSummary: Visual memory graph for human-AI collaboration.\\nAccepted memories:\\n' + accepted)
    }
    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]))
    }
    refresh()
  </script>
</body>
</html>`
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, {})

  if (req.url === '/api/atlas' && req.method === 'GET') {
    return sendJson(res, buildAtlas())
  }

  if (req.url === '/api/ingest' && req.method === 'POST') {
    const body = await readBody(req)
    if (!body || (!body.userInput && !body.aiOutput)) {
      return sendJson(res, { error: 'userInput or aiOutput is required' }, 400)
    }
    const events = readEvents()
    const event = {
      id: `preview-${Date.now()}`,
      surface: body.surface || 'Manual',
      userInput: body.userInput || '',
      aiOutput: body.aiOutput || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    writeEvents([event, ...events])
    return sendJson(res, { event })
  }

  if (req.url === '/api/memory-candidates' && req.method === 'PATCH') {
    const body = await readBody(req)
    if (!body || !body.id || !['accepted', 'rejected', 'pending'].includes(body.status)) {
      return sendJson(res, { error: 'id and valid status are required' }, 400)
    }
    const events = readEvents()
    const next = events.map((event) => event.id === body.id ? { ...event, status: body.status } : event)
    writeEvents(next)
    return sendJson(res, { review: { id: body.id, status: body.status } })
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(pageHtml())
})

server.listen(port, host, () => {
  console.log(`AI Memory Atlas preview running at http://${host}:${port}`)
})
