'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleDot,
  Command,
  Compass,
  Copy,
  Keyboard,
  Layers3,
  Link2,
  Mic2,
  Network,
  PanelRight,
  Plus,
  Radio,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  SECOND_BRAIN_STORAGE_KEY,
  createMemoryEvent,
  mergeEvents,
  starterEvents,
  type IngestionRecord,
  type MemoryEvent,
  type RawCaptureRecord,
} from '@/lib/second-brain'
import { VoiceRecorder, type VoiceRecorderHandle } from './voice-recorder'

type BrainNodeType = 'idea' | 'project' | 'question' | 'task' | 'artifact' | 'source'

interface BrainNode {
  id: string
  label: string
  type: BrainNodeType
  x: number
  y: number
  size: number
}

interface BrainEdge {
  from: string
  to: string
  label: string
}

interface BoundaryPrompt {
  title: string
  description: string
  prompt: string
  impact: string
}

interface CaptureDiagnostic {
  id: string
  type: 'heartbeat' | 'dom-scan' | 'network-event' | 'ingest-success' | 'ingest-error'
  surface?: string
  url?: string
  message: string
  captureMethod?: 'dom' | 'network'
  timestamp: number
}

const aiSurfaces = ['OpenClaw', 'ChatGPT', 'Claude', 'Cursor', 'Browser', 'Desktop', 'Voice Layer']
const NUDGE_THRESHOLD = 72

const ingestionConnectors = [
  {
    name: 'Browser plugin',
    status: 'Best proof for ChatGPT / Claude web',
    detail: 'Content scripts read chat DOM, watch mutations, and send prompt/answer pairs into the memory API.',
    coverage: 82,
  },
  {
    name: 'MCP server',
    status: 'Best proof for agents / IDEs',
    detail: 'Expose AI chat logs as MCP resources with list/read/subscribe semantics for hosts that support MCP.',
    coverage: 68,
  },
  {
    name: 'API / webhook',
    status: 'Best proof for OpenClaw and owned apps',
    detail: 'Apps post completed runs, tool traces, artifacts, and user accept/reject signals directly to Second Brain.',
    coverage: 76,
  },
]

const baseNodes: BrainNode[] = [
  { id: 'project', label: 'Second Brain for AI Chats', type: 'project', x: 320, y: 185, size: 56 },
  { id: 'voice', label: 'AI voice input layer', type: 'idea', x: 130, y: 82, size: 40 },
  { id: 'capture', label: 'Cross-app capture', type: 'source', x: 480, y: 76, size: 39 },
  { id: 'graph', label: 'Knowledge graph asset', type: 'artifact', x: 178, y: 306, size: 44 },
  { id: 'memory', label: 'Agent memory for OpenClaw', type: 'idea', x: 505, y: 296, size: 42 },
  { id: 'question', label: 'How to capture context safely?', type: 'question', x: 310, y: 390, size: 35 },
]

const baseEdges: BrainEdge[] = [
  { from: 'voice', to: 'project', label: 'feeds' },
  { from: 'capture', to: 'project', label: 'records' },
  { from: 'project', to: 'graph', label: 'creates' },
  { from: 'project', to: 'memory', label: 'powers' },
  { from: 'graph', to: 'question', label: 'reveals' },
  { from: 'memory', to: 'question', label: 'constrains' },
]

const expansionPrompts: BoundaryPrompt[] = [
  {
    title: 'Close the capture gap',
    description: 'You keep discussing cross-app AI work, but the graph has no concrete capture strategy yet.',
    prompt: 'Design the lowest-friction way to capture ChatGPT, Claude, Cursor, and OpenClaw input/output with user consent.',
    impact: 'Turns the product from a local demo into a memory layer for every AI surface.',
  },
  {
    title: 'Make memory actionable',
    description: 'The graph has ideas and questions, but only a few executable follow-ups.',
    prompt: 'Convert my current Second Brain graph into a 7-day build plan with tasks, owners, and demo milestones.',
    impact: 'Moves from knowledge storage to guided execution.',
  },
  {
    title: 'Define the trust boundary',
    description: 'A second brain for AI chats needs privacy, redaction, and user-visible control.',
    prompt: 'Create a privacy model for an AI conversation second brain: local-first data, redaction, permissions, and deletion flows.',
    impact: 'Makes the product credible for real personal and work conversations.',
  },
]

const nodeStyles: Record<BrainNodeType, string> = {
  project: 'fill-emerald-400 stroke-emerald-200',
  idea: 'fill-cyan-400 stroke-cyan-100',
  question: 'fill-amber-300 stroke-amber-100',
  task: 'fill-sky-500 stroke-sky-200',
  artifact: 'fill-fuchsia-400 stroke-fuchsia-100',
  source: 'fill-orange-300 stroke-orange-100',
}

const nodeText: Record<BrainNodeType, string> = {
  project: 'Project',
  idea: 'Idea',
  question: 'Question',
  task: 'Task',
  artifact: 'Artifact',
  source: 'Source',
}

function buildGraph(events: MemoryEvent[]): { nodes: BrainNode[]; edges: BrainEdge[] } {
  const extraNodes = events.slice(3).map((event, index) => ({
    id: event.id,
    label: event.extracted[0] || 'New captured idea',
    type: 'task' as BrainNodeType,
    x: 92 + index * 118,
    y: 438,
    size: 31,
  }))

  const extraEdges = extraNodes.map((node) => ({
    from: 'project',
    to: node.id,
    label: 'captured',
  }))

  return {
    nodes: [...baseNodes, ...extraNodes],
    edges: [...baseEdges, ...extraEdges],
  }
}

function getTopicFrequency(events: MemoryEvent[]) {
  const counts = new Map<string, number>()
  events.forEach((event) => {
    event.extracted.forEach((concept) => {
      counts.set(concept, (counts.get(concept) || 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      score: Math.min(100, count * 24 + events.length * 4),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

function getProfileSignals(events: MemoryEvent[]) {
  const allText = events.map((event) => `${event.userInput} ${event.aiOutput}`).join(' ').toLowerCase()
  return [
    {
      label: 'Builder profile',
      value: allText.includes('openclaw') || allText.includes('product') ? 'agent product builder' : 'AI power user',
      confidence: 84,
    },
    {
      label: 'Dominant intent',
      value: allText.includes('privacy') ? 'trusted memory infrastructure' : 'turn AI chats into reusable context',
      confidence: 78,
    },
    {
      label: 'Active frontier',
      value: allText.includes('capture') ? 'automatic capture across AI surfaces' : 'graph-based recall',
      confidence: 73,
    },
  ]
}

export function VoiceAgent() {
  const recorderRef = useRef<VoiceRecorderHandle | null>(null)
  const [events, setEvents] = useState<MemoryEvent[]>(starterEvents)
  const [surfaceDraft, setSurfaceDraft] = useState('OpenClaw')
  const [draftInput, setDraftInput] = useState('Help me turn OpenClaw and all AI chats into a living second brain.')
  const [draftOutput, setDraftOutput] = useState('This should become a memory layer that captures prompts, outputs, decisions, tasks, and artifacts, then turns them into a knowledge graph.')
  const [recordingTime, setRecordingTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [realtimeTranscript, setRealtimeTranscript] = useState('')
  const [selectedEventId, setSelectedEventId] = useState(starterEvents[0].id)
  const [copiedPrompt, setCopiedPrompt] = useState('')
  const [diagnostics, setDiagnostics] = useState<CaptureDiagnostic[]>([])
  const [rawCaptures, setRawCaptures] = useState<RawCaptureRecord[]>([])
  const [ingestionRecords, setIngestionRecords] = useState<IngestionRecord[]>([])

  const graph = useMemo(() => buildGraph(events), [events])
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0]
  const nodeCount = graph.nodes.length
  const edgeCount = graph.edges.length
  const extractedCount = events.reduce((total, event) => total + event.extracted.length, 0)
  const topicFrequency = useMemo(() => getTopicFrequency(events), [events])
  const profileSignals = useMemo(() => getProfileSignals(events), [events])
  const strongestTopic = topicFrequency[0]
  const nudgeReadiness = Math.min(100, events.length * 14 + edgeCount * 5 + (strongestTopic?.count || 0) * 9)
  const canNudge = nudgeReadiness >= NUDGE_THRESHOLD

  useEffect(() => {
    const saved = window.localStorage.getItem(SECOND_BRAIN_STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved) as MemoryEvent[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setEvents(parsed)
        setSelectedEventId(parsed[0].id)
      }
    } catch {
      window.localStorage.removeItem(SECOND_BRAIN_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SECOND_BRAIN_STORAGE_KEY, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    let cancelled = false

    const syncServerState = async () => {
      try {
        const [eventsResponse, diagnosticsResponse, sourceResponse] = await Promise.all([
          fetch('/api/events', { cache: 'no-store' }),
          fetch('/api/capture-status', { cache: 'no-store' }),
          fetch('/api/source', { cache: 'no-store' }),
        ])

        if (diagnosticsResponse.ok) {
          const diagnosticsData = await diagnosticsResponse.json() as { diagnostics?: CaptureDiagnostic[] }
          if (!cancelled && Array.isArray(diagnosticsData.diagnostics)) {
            setDiagnostics(diagnosticsData.diagnostics)
          }
        }

        if (sourceResponse.ok) {
          const sourceData = await sourceResponse.json() as { raw?: RawCaptureRecord[]; ingestion?: IngestionRecord[] }
          if (!cancelled) {
            setRawCaptures(Array.isArray(sourceData.raw) ? sourceData.raw : [])
            setIngestionRecords(Array.isArray(sourceData.ingestion) ? sourceData.ingestion : [])
          }
        }

        if (!eventsResponse.ok) return
        const data = await eventsResponse.json() as { events?: MemoryEvent[] }
        if (cancelled || !Array.isArray(data.events) || data.events.length === 0) return

        setEvents((current) => {
          const merged = mergeEvents(current, data.events || [])
          if (merged[0]?.id) setSelectedEventId(merged[0].id)
          return merged
        })
      } catch {
        // Local API may be unavailable during static previews.
      }
    }

    syncServerState()
    const interval = window.setInterval(syncServerState, 2500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!isRecording) return

    const interval = window.setInterval(() => {
      setRecordingTime((time) => time + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isRecording])

  const addMemoryEvent = async (input = draftInput, output = draftOutput, source: MemoryEvent['source'] = 'manual') => {
    const event = createMemoryEvent({
      surface: surfaceDraft,
      userInput: input,
      aiOutput: output,
      source,
    })
    setEvents((current) => mergeEvents(current, [event]))
    setSelectedEventId(event.id)
    setDraftInput('')
    setDraftOutput('')
    setRealtimeTranscript('')

    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: event.surface,
          userInput: event.userInput,
          aiOutput: event.aiOutput,
          source,
        }),
      })
    } catch {
      // Manual capture still works locally through state/localStorage.
    }
  }

  const loadSampleConversation = () => {
    setSurfaceDraft('Claude')
    setDraftInput('I keep having useful AI chats about my startup, but the insights disappear after each session. Help me design a second brain for those conversations.')
    setDraftOutput('Start with capture, not organization. Store the prompt, answer, user edits, accepted decisions, generated artifacts, and follow-up questions. Then build graph views around projects, open loops, and reusable ideas.')
  }

  const copyExpansionPrompt = async (prompt: string) => {
    setDraftInput(prompt)
    setDraftOutput('')
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      window.setTimeout(() => setCopiedPrompt(''), 1500)
    } catch {
      setCopiedPrompt('')
    }
  }

  const handleStartRecording = () => {
    setIsRecording(true)
    setRecordingTime(0)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    const input = realtimeTranscript.trim() || draftInput.trim() || 'Voice note: build a second brain for AI conversations.'
    addMemoryEvent(input, draftOutput, 'voice')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-black">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Second Brain</h1>
              <p className="text-xs text-muted-foreground">Memory and knowledge layer for OpenClaw and every AI surface</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="outline" className="gap-1 border-emerald-400/30 text-emerald-300">
              <Radio className="h-3 w-3" />
              voice entry
            </Badge>
            <Badge variant="outline" className="gap-1 border-cyan-400/30 text-cyan-300">
              <Network className="h-3 w-3" />
              graph asset
            </Badge>
            <Badge variant="outline" className="gap-1 border-amber-300/30 text-amber-200">
              <Compass className="h-3 w-3" />
              boundary expansion
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic2 className="h-4 w-4 text-emerald-300" />
                  Capture Console
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">end product demo</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
                <p className="text-sm font-medium">Capture one real AI interaction</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Speak or paste your prompt, paste the AI response, then turn the exchange into graph memory.
                </p>
              </div>

              <VoiceRecorder
                ref={recorderRef}
                isRecording={isRecording}
                recordingTime={recordingTime}
                isProcessing={false}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onRealtimeTranscript={setRealtimeTranscript}
                onError={(error) => setDraftInput(error)}
              />

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-border bg-secondary/40 p-2">
                  <p className="font-mono text-foreground">⌘⌥V</p>
                  <p className="text-muted-foreground">capture</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-2">
                  <p className="font-mono text-foreground">OpenClaw</p>
                  <p className="text-muted-foreground">agent</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-2">
                  <p className="font-mono text-foreground">Graph</p>
                  <p className="text-muted-foreground">memory</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">AI surface</span>
                    <select
                      value={surfaceDraft}
                      onChange={(event) => setSurfaceDraft(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {aiSurfaces.map((surface) => (
                        <option key={surface} value={surface}>{surface}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button variant="outline" size="sm" onClick={loadSampleConversation}>
                      Try sample
                    </Button>
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Your prompt or voice transcript</span>
                <Textarea
                  value={realtimeTranscript || draftInput}
                  onChange={(event) => setDraftInput(event.target.value)}
                    className="min-h-24 resize-none"
                    placeholder="Speak or paste the prompt you sent to an AI app..."
                />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">AI response</span>
                  <Textarea
                    value={draftOutput}
                    onChange={(event) => setDraftOutput(event.target.value)}
                    className="min-h-28 resize-none"
                    placeholder="Paste the AI output here..."
                  />
                </label>

                <Button className="w-full gap-2" onClick={() => addMemoryEvent()}>
                  <Plus className="h-4 w-4" />
                  Capture interaction to graph
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-4 w-4 text-cyan-300" />
                Memory Inbox
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Click an interaction to inspect the captured prompt, AI answer, and extracted graph links.
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] pr-3">
                <div className="space-y-3">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        selectedEventId === event.id
                          ? 'border-emerald-400/50 bg-emerald-400/10'
                          : 'border-border bg-secondary/20 hover:bg-secondary/40'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs">{event.surface}</Badge>
                        <div className="flex items-center gap-2">
                          {event.captureMethod && (
                            <span className="rounded-md bg-background px-2 py-0.5 text-[10px] uppercase text-cyan-300">
                              {event.captureMethod}
                            </span>
                          )}
                          <span className="text-xs text-emerald-300">{event.graphDelta}</span>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground/90">{event.userInput}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {event.extracted.slice(0, 3).map((item) => (
                          <span key={item} className="rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            {item}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Memory events', events.length.toString(), 'input + output traces'],
              ['Graph nodes', nodeCount.toString(), 'ideas, tasks, sources'],
              ['Meaning links', edgeCount.toString(), 'necessary links made'],
            ].map(([label, value, detail]) => (
              <Card key={label} className="border-border bg-card">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-4 w-4 text-cyan-300" />
                    Live Knowledge Graph
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Captured conversations become typed nodes and necessary links.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(nodeText).map(([type, label]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative min-h-[520px] bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.14),transparent_28%),radial-gradient(circle_at_70%_30%,rgba(34,211,238,0.11),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]">
                <svg viewBox="0 0 640 500" className="h-[520px] w-full">
                  <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L0,6 L9,3 z" fill="rgba(148,163,184,0.75)" />
                    </marker>
                  </defs>
                  {graph.edges.map((edge) => {
                    const from = graph.nodes.find((node) => node.id === edge.from)
                    const to = graph.nodes.find((node) => node.id === edge.to)
                    if (!from || !to) return null
                    const midX = (from.x + to.x) / 2
                    const midY = (from.y + to.y) / 2
                    return (
                      <g key={`${edge.from}-${edge.to}`}>
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="rgba(148,163,184,0.55)"
                          strokeWidth="1.5"
                          markerEnd="url(#arrow)"
                        />
                        <text x={midX} y={midY - 5} textAnchor="middle" className="fill-slate-400 text-[10px]">
                          {edge.label}
                        </text>
                      </g>
                    )
                  })}
                  {graph.nodes.map((node) => (
                    <g key={node.id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.size}
                        className={cn(nodeStyles[node.type], 'stroke-2')}
                        opacity="0.9"
                      />
                      <circle cx={node.x} cy={node.y} r={node.size + 8} fill="none" stroke="rgba(255,255,255,0.08)" />
                      <text x={node.x} y={node.y - 2} textAnchor="middle" className="fill-black text-[10px] font-semibold">
                        {nodeText[node.type]}
                      </text>
                      <text x={node.x} y={node.y + node.size + 18} textAnchor="middle" className="fill-slate-100 text-[12px]">
                        {node.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PanelRight className="h-4 w-4 text-emerald-300" />
                Project Memory
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                This is the reusable context future AI sessions should inherit.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="input">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="input">Input</TabsTrigger>
                  <TabsTrigger value="output">Output</TabsTrigger>
                  <TabsTrigger value="links">Links</TabsTrigger>
                </TabsList>
                <TabsContent value="input" className="mt-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm leading-relaxed">
                  {selectedEvent.userInput}
                </TabsContent>
                <TabsContent value="output" className="mt-4 rounded-lg border border-border bg-secondary/20 p-4 text-sm leading-relaxed">
                  {selectedEvent.aiOutput}
                </TabsContent>
                <TabsContent value="links" className="mt-4 space-y-2">
                  {selectedEvent.captureMethod && (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-emerald-300" />
                        Capture method
                      </span>
                      <Badge variant="outline">{selectedEvent.captureMethod}</Badge>
                    </div>
                  )}
                  {selectedEvent.url && (
                    <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
                      <p className="mb-1 text-xs text-muted-foreground">Source URL</p>
                      <p className="break-all text-xs text-foreground/80">{selectedEvent.url}</p>
                    </div>
                  )}
                  {selectedEvent.extracted.map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-cyan-300" />
                        {item}
                      </span>
                      <Badge variant="outline">linked</Badge>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setSurfaceDraft(selectedEvent.surface)
                    setDraftInput(`Continue from this memory: ${selectedEvent.userInput}`)
                    setDraftOutput('')
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  Continue thread
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => copyExpansionPrompt(`Use this memory as context and propose the next concrete product experiment: ${selectedEvent.extracted.join(', ')}`)}
                >
                  <Copy className="h-4 w-4" />
                  Copy next prompt
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleDot className="h-4 w-4 text-cyan-300" />
                  Topic Frequency
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Repeated concepts should weigh more than one-off mentions.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {topicFrequency.map((item) => (
                  <div key={item.topic} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.topic}</span>
                      <span className="font-mono text-xs text-muted-foreground">{item.count}x</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-cyan-300" style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4 text-emerald-300" />
                  User Profile Signals
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  The graph should model the user, not only the chat text.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {profileSignals.map((signal) => (
                  <div key={signal.label} className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{signal.label}</p>
                      <span className="font-mono text-xs text-emerald-300">{signal.confidence}%</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{signal.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-5">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4 text-emerald-300" />
                Auto Capture Proof
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                The product needs automatic access to AI outputs, not manual note-taking.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {ingestionConnectors.map((connector) => (
                <div key={connector.name} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{connector.name}</p>
                      <p className="mt-1 text-xs text-emerald-300">{connector.status}</p>
                    </div>
                    <span className="rounded-md bg-background px-2 py-1 text-xs font-mono">{connector.coverage}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-emerald-300" style={{ width: `${connector.coverage}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{connector.detail}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="text-sm font-medium">Source audit trail</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Captured AI I/O first lands in raw source, then gets synthesized into ingestion records before graph promotion.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-background p-3">
                    <p className="font-mono text-lg text-emerald-300">{rawCaptures.length}</p>
                    <p className="text-muted-foreground">raw captures</p>
                  </div>
                  <div className="rounded-md bg-background p-3">
                    <p className="font-mono text-lg text-cyan-300">{ingestionRecords.length}</p>
                    <p className="text-muted-foreground">ingestion records</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Live diagnostics</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Confirms whether the extension injected, scanned DOM, saw network calls, or posted events.
                    </p>
                  </div>
                  <Badge variant={diagnostics.length > 0 ? 'default' : 'outline'}>
                    {diagnostics.length > 0 ? 'active' : 'waiting'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {diagnostics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Load the extension, open `/mock-ai` or a supported AI app, then interact with the page.
                    </p>
                  ) : (
                    diagnostics.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-md bg-background px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{item.type}</span>
                          <span className="text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{item.message}</p>
                        <p className="mt-1 text-cyan-300">
                          {[item.surface, item.captureMethod].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="h-4 w-4 text-amber-200" />
                Boundary Expansion
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Nudges only appear when the graph has enough repeated signal.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={cn(
                'rounded-lg border p-3',
                canNudge ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-amber-300/30 bg-amber-300/10'
              )}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{canNudge ? 'Nudge is allowed' : 'Nudge held back'}</span>
                  <span className="font-mono">{nudgeReadiness}/{NUDGE_THRESHOLD}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className={cn('h-full rounded-full', canNudge ? 'bg-emerald-300' : 'bg-amber-300')}
                    style={{ width: `${Math.min(100, nudgeReadiness)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Signal combines chat count, link density, topic repetition, and profile confidence.
                </p>
              </div>
              {expansionPrompts.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="flex items-start gap-2">
                    <CircleDot className="mt-0.5 h-4 w-4 text-amber-200" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyExpansionPrompt(item.prompt)}
                    className="mt-3 w-full rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-left text-xs leading-relaxed text-amber-50 transition-colors hover:bg-amber-300/15"
                  >
                    {item.prompt}
                  </button>
                  {copiedPrompt === item.prompt && (
                    <p className="mt-2 text-xs text-emerald-300">Copied and loaded into the capture console.</p>
                  )}
                  <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                    {item.impact}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                Demo Narrative
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Voice entry', 'User speaks to any AI app through one input layer.'],
                ['Graph asset', `${extractedCount} extracted concepts become reusable nodes and links.`],
                ['Expansion loop', 'The graph recommends new prompts, tasks, and trust boundaries.'],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Command className="h-4 w-4 text-cyan-300" />
                Future Surfaces
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              {['ChatGPT', 'Claude', 'Cursor', 'OpenClaw', 'Browser', 'Desktop'].map((surface) => (
                <div key={surface} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="font-medium">{surface}</p>
                  <p className="mt-1 text-muted-foreground">input/output capture</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full gap-2" onClick={() => copyExpansionPrompt(expansionPrompts[0].prompt)}>
            <Wand2 className="h-4 w-4" />
            Load next exploration prompt
          </Button>

          <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Keyboard className="h-4 w-4" />
              Product thesis
            </p>
            <p className="mt-2 leading-relaxed">
              Voice is the entry. Graph is the asset. Boundary expansion is the reason users return.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
