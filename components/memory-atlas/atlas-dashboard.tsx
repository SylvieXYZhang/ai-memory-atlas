'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCopy,
  Clock3,
  FileText,
  Filter,
  GitBranch,
  History,
  Lightbulb,
  MessageSquareText,
  Network,
  PackageCheck,
  PanelRight,
  Search,
  Sparkles,
  Target,
  XCircle,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  atlasProjects as seedProjects,
  memoryEdges as seedEdges,
  memoryNodes as seedNodes,
  mockAiChats as seedChats,
  timelineMoments as seedTimeline,
} from '@/lib/memory-atlas/seed-data'
import type { AtlasProject, MemoryCandidate, MemoryEdge, MemoryNode, MemoryNodeType, MockAiChat, TimelineMoment } from '@/lib/memory-atlas/types'

const nodeColor: Record<MemoryNodeType, { fill: string; stroke: string; text: string; bg: string; label: string }> = {
  project: { fill: '#34d399', stroke: '#a7f3d0', text: 'text-emerald-200', bg: 'bg-emerald-400/10 border-emerald-400/25', label: 'Project' },
  idea: { fill: '#22d3ee', stroke: '#a5f3fc', text: 'text-cyan-200', bg: 'bg-cyan-400/10 border-cyan-400/25', label: 'Idea' },
  decision: { fill: '#fbbf24', stroke: '#fde68a', text: 'text-amber-200', bg: 'bg-amber-400/10 border-amber-400/25', label: 'Decision' },
  task: { fill: '#60a5fa', stroke: '#bfdbfe', text: 'text-blue-200', bg: 'bg-blue-400/10 border-blue-400/25', label: 'Task' },
  artifact: { fill: '#f472b6', stroke: '#fbcfe8', text: 'text-pink-200', bg: 'bg-pink-400/10 border-pink-400/25', label: 'Artifact' },
  question: { fill: '#fb7185', stroke: '#fecdd3', text: 'text-rose-200', bg: 'bg-rose-400/10 border-rose-400/25', label: 'Question' },
  preference: { fill: '#a78bfa', stroke: '#ddd6fe', text: 'text-violet-200', bg: 'bg-violet-400/10 border-violet-400/25', label: 'Preference' },
  failure: { fill: '#f97316', stroke: '#fed7aa', text: 'text-orange-200', bg: 'bg-orange-400/10 border-orange-400/25', label: 'Failure' },
  tool: { fill: '#2dd4bf', stroke: '#99f6e4', text: 'text-teal-200', bg: 'bg-teal-400/10 border-teal-400/25', label: 'Tool' },
  person: { fill: '#e5e7eb', stroke: '#ffffff', text: 'text-zinc-100', bg: 'bg-zinc-400/10 border-zinc-400/25', label: 'Person' },
}

const typeFilters: MemoryNodeType[] = ['project', 'idea', 'decision', 'task', 'artifact', 'question', 'preference', 'tool']

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

interface AtlasPayload {
  nodes: MemoryNode[]
  edges: MemoryEdge[]
  chats: MockAiChat[]
  projects: AtlasProject[]
  timeline: TimelineMoment[]
  candidates: MemoryCandidate[]
  liveEventCount: number
  toolNoteCount: number
}

function findNode(nodes: MemoryNode[], id: string) {
  return nodes.find((node) => node.id === id)
}

function createProjectContext(projectId: string, projects: AtlasProject[], nodes: MemoryNode[]) {
  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const pick = (ids: string[]) => ids.map((id) => findNode(nodes, id)).filter(Boolean) as MemoryNode[]
  const decisions = pick(project.decisionIds)
  const tasks = pick(project.taskIds)
  const artifacts = pick(project.artifactIds)
  const questions = pick(project.questionIds)

  return [
    `Project: ${project.title}`,
    `Status: ${project.status}`,
    `Summary: ${project.summary}`,
    '',
    'Key decisions:',
    ...decisions.map((node) => `- ${node.title}: ${node.summary}`),
    '',
    'Open questions:',
    ...questions.map((node) => `- ${node.title}: ${node.summary}`),
    '',
    'Active tasks:',
    ...tasks.map((node) => `- ${node.title}: ${node.summary}`),
    '',
    'Artifacts:',
    ...artifacts.map((node) => `- ${node.title}: ${node.summary}`),
  ].join('\n')
}

function CandidateCard({
  candidate,
  onReview,
}: {
  candidate: MemoryCandidate
  onReview: (candidate: MemoryCandidate, edits: { status: 'accepted' | 'rejected'; title: string; type: MemoryNodeType; summary: string }) => void
}) {
  const [title, setTitle] = useState(candidate.title)
  const [type, setType] = useState<MemoryNodeType>(candidate.type)
  const [summary, setSummary] = useState(candidate.summary)

  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{candidate.surface}</Badge>
          {candidate.sourceChat.provider && (
            <Badge variant="outline" className="border-cyan-400/35 text-[10px] text-cyan-200">hook</Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              'border text-[10px]',
              candidate.promptPurpose === 'knowledge' && 'border-blue-400/35 text-blue-200',
              candidate.promptPurpose === 'thinking' && 'border-fuchsia-400/35 text-fuchsia-200',
            )}
          >
            {candidate.memoryRepresentation}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'border text-[10px]',
              candidate.status === 'accepted' && 'border-emerald-400/35 text-emerald-200',
              candidate.status === 'rejected' && 'border-rose-400/35 text-rose-200',
              candidate.status === 'pending' && 'border-amber-400/35 text-amber-200',
            )}
          >
            {candidate.status}
          </Badge>
        </div>
        <Badge className={cn('border text-[10px]', nodeColor[type].bg, nodeColor[type].text)} variant="outline">{nodeColor[type].label}</Badge>
      </div>

      <label className="mt-3 block space-y-1">
        <span className="text-[11px] text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="mt-2 block space-y-1">
        <span className="text-[11px] text-muted-foreground">Type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as MemoryNodeType)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {typeFilters.map((item) => (
            <option key={item} value={item}>{nodeColor[item].label}</option>
          ))}
        </select>
      </label>

      <label className="mt-2 block space-y-1">
        <span className="text-[11px] text-muted-foreground">Summary</span>
        <Textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="min-h-20 resize-none text-xs"
        />
      </label>

      <div className="mt-3 rounded-md border border-border bg-card/70 p-2 text-[11px] leading-relaxed text-muted-foreground">
        {candidate.evidence[0]}
        {candidate.boundarySignals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {candidate.boundarySignals.map((signal) => (
              <span key={signal} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {signal}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          className="gap-1"
          disabled={candidate.status === 'accepted'}
          onClick={() => onReview(candidate, { status: 'accepted', title, type, summary })}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {candidate.status === 'accepted' ? 'In graph' : 'Accept'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={candidate.status === 'rejected'}
          onClick={() => onReview(candidate, { status: 'rejected', title, type, summary })}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  )
}

export function AtlasDashboard() {
  const [selectedNodeId, setSelectedNodeId] = useState('project-atlas')
  const [activeTypes, setActiveTypes] = useState<MemoryNodeType[]>(typeFilters)
  const [copied, setCopied] = useState(false)
  const [atlas, setAtlas] = useState<AtlasPayload>({
    nodes: seedNodes,
    edges: seedEdges,
    chats: seedChats,
    projects: seedProjects,
    timeline: seedTimeline,
    candidates: [],
    liveEventCount: 0,
    toolNoteCount: 0,
  })
  const [surfaceDraft, setSurfaceDraft] = useState('ChatGPT')
  const [promptDraft, setPromptDraft] = useState('我刚和 AI 讨论了 AI Memory Atlas 的正式产品方向：真实聊天应该进入图谱，而不是只停留在静态 demo。')
  const [responseDraft, setResponseDraft] = useState('正式产品的第一步应该打通 Capture → Structure → Visualize：把 ingest 事件抽成 typed memory nodes，并在图谱里显示 evidence 和 source chats。')
  const [isCapturing, setIsCapturing] = useState(false)

  const selectedNode = findNode(atlas.nodes, selectedNodeId) ?? atlas.nodes[0]
  const selectedChats = atlas.chats.filter((chat) => selectedNode.sourceChatIds.includes(chat.id))
  const relatedEdges = atlas.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
  const selectedProject = atlas.projects[0]
  const visibleNodes = atlas.nodes.filter((node) => activeTypes.includes(node.type) || node.type === 'person' || node.id === selectedNodeId)
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = atlas.edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
  const pendingCandidates = atlas.candidates.filter((candidate) => candidate.status === 'pending')
  const acceptedCandidateCount = atlas.candidates.filter((candidate) => candidate.status === 'accepted').length
  const rejectedCandidateCount = atlas.candidates.filter((candidate) => candidate.status === 'rejected').length
  const visibleCandidates = [...atlas.candidates].sort((a, b) => {
    const rank = { pending: 0, accepted: 1, rejected: 2 }
    return rank[a.status] - rank[b.status] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const projectLensSections: Array<[string, string[], LucideIcon]> = [
    ['Decisions', selectedProject.decisionIds, CheckCircle2],
    ['Tasks', selectedProject.taskIds, Target],
    ['Artifacts', selectedProject.artifactIds, PackageCheck],
    ['Questions', selectedProject.questionIds, Search],
  ]

  const nodeStats = useMemo(() => {
    const sourceCount = new Set(atlas.chats.map((chat) => chat.surface)).size
    const evidenceCount = atlas.nodes.reduce((total, node) => total + node.evidence.length, 0)
    return [
      { label: 'Memory nodes', value: atlas.nodes.length.toString(), icon: Network },
      { label: 'Source chats', value: atlas.chats.length.toString(), icon: MessageSquareText },
      { label: 'AI surfaces', value: sourceCount.toString(), icon: Archive },
      { label: 'Evidence clips', value: evidenceCount.toString(), icon: FileText },
      { label: 'Tool notes', value: atlas.toolNoteCount.toString(), icon: ClipboardCopy },
    ]
  }, [atlas])

  const refreshAtlas = async () => {
    try {
      const response = await fetch('/api/atlas', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as AtlasPayload
      setAtlas(data)
      if (!data.nodes.some((node) => node.id === selectedNodeId)) {
        setSelectedNodeId(data.nodes[0]?.id ?? 'project-atlas')
      }
    } catch {
      // The seed graph remains usable during static previews.
    }
  }

  useEffect(() => {
    refreshAtlas()
    const interval = window.setInterval(refreshAtlas, 3500)
    return () => window.clearInterval(interval)
  }, [])

  const toggleType = (type: MemoryNodeType) => {
    setActiveTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  }

  const copyProjectContext = async () => {
    const context = createProjectContext(selectedProject.id, atlas.projects, atlas.nodes)
    try {
      await navigator.clipboard.writeText(context)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const captureInteraction = async () => {
    if (!promptDraft.trim() && !responseDraft.trim()) return
    setIsCapturing(true)
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: surfaceDraft,
          userInput: promptDraft,
          aiOutput: responseDraft,
          source: 'manual',
          captureMethod: 'manual',
        }),
      })
      if (response.ok) {
        setPromptDraft('')
        setResponseDraft('')
        await refreshAtlas()
      }
    } finally {
      setIsCapturing(false)
    }
  }

  const reviewCandidate = async (
    candidate: MemoryCandidate,
    edits: { status: 'accepted' | 'rejected'; title: string; type: MemoryNodeType; summary: string },
  ) => {
    await fetch('/api/memory-candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: candidate.id,
        status: edits.status,
        title: edits.title,
        type: edits.type,
        summary: edits.summary,
      }),
    })
    await refreshAtlas()
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-300 text-zinc-950">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">AI Memory Atlas</h1>
              <p className="text-sm text-muted-foreground">A growing map of projects, decisions, tasks, artifacts, and preferences from human-AI work.</p>
            </div>
          </div>
          {atlas.liveEventCount > 0 && (
            <Badge className="w-fit bg-emerald-300 text-zinc-950">
              {atlas.liveEventCount} live captures added
            </Badge>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {nodeStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-secondary/35 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <stat.icon className="h-3.5 w-3.5" />
                  {stat.label}
                </div>
                <div className="mt-1 text-xl font-semibold">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-emerald-200" />
                Capture To Atlas
              </h2>
              <Badge variant="outline" className="text-xs">live</Badge>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">AI surface</span>
                <select
                  value={surfaceDraft}
                  onChange={(event) => setSurfaceDraft(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {['ChatGPT', 'Claude', 'Claude Code', 'Codex', 'Cursor', 'OpenClaw', 'Other AI'].map((surface) => (
                    <option key={surface} value={surface}>{surface}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">User message</span>
                <Textarea
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  className="min-h-24 resize-none text-xs"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">AI response</span>
                <Textarea
                  value={responseDraft}
                  onChange={(event) => setResponseDraft(event.target.value)}
                  className="min-h-28 resize-none text-xs"
                />
              </label>
              <Button className="w-full gap-2" onClick={captureInteraction} disabled={isCapturing}>
                <MessageSquareText className="h-4 w-4" />
                {isCapturing ? 'Capturing...' : 'Add as candidate'}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-amber-200" />
                Memory Inbox
              </h2>
              <Badge variant="outline" className="text-xs">{atlas.candidates.length} total</Badge>
            </div>
            <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
              <span>{acceptedCandidateCount} accepted</span>
              <span>·</span>
              <span>{rejectedCandidateCount} rejected</span>
            </div>
            <ScrollArea className="mt-3 h-[430px] pr-3">
              <div className="space-y-3">
                {visibleCandidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onReview={reviewCandidate} />
                ))}
                {visibleCandidates.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
                    New captures will appear here as editable memory candidates before they enter the graph.
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-cyan-200" />
                Node Types
              </h2>
              <Badge variant="outline" className="text-xs">{activeTypes.length} on</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {typeFilters.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-left text-xs transition',
                    activeTypes.includes(type) ? nodeColor[type].bg : 'border-border bg-secondary/25 text-muted-foreground'
                  )}
                >
                  <span className={cn('font-medium', activeTypes.includes(type) && nodeColor[type].text)}>{nodeColor[type].label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-emerald-200" />
              Source Chats
            </h2>
            <ScrollArea className="mt-3 h-[520px] pr-3">
              <div className="space-y-2">
                {atlas.chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedNodeId(chat.extractedNodeIds[0])}
                    className="w-full rounded-lg border border-border bg-secondary/25 p-3 text-left transition hover:border-emerald-300/45 hover:bg-secondary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium">{chat.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{chat.surface}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{chat.userMessage}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {formatDate(chat.capturedAt)}
                    </p>
                    {(chat.sessionId || chat.cwd) && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        {chat.sessionId ? `Session ${chat.sessionId}` : chat.cwd}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Network className="h-4 w-4 text-emerald-200" />
                  Personal Memory Graph
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Seed memories plus live captures from ChatGPT, Claude, Codex, Cursor, OpenClaw, and manual paste.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-400/30 text-emerald-200">graph-first</Badge>
                <Badge variant="outline" className="border-cyan-400/30 text-cyan-200">evidence-backed</Badge>
                <Badge variant="outline" className="border-pink-400/30 text-pink-200">replayable</Badge>
              </div>
            </div>

            <div className="relative h-[640px] overflow-hidden">
              <svg viewBox="0 0 920 660" className="h-full w-full">
                <defs>
                  <pattern id="atlas-grid" width="34" height="34" patternUnits="userSpaceOnUse">
                    <path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
                  </pattern>
                  <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect width="920" height="660" fill="url(#atlas-grid)" />
                {visibleEdges.map((edge) => {
                  const from = findNode(atlas.nodes, edge.from)
                  const to = findNode(atlas.nodes, edge.to)
                  if (!from || !to) return null
                  const active = edge.from === selectedNode.id || edge.to === selectedNode.id
                  return (
                    <g key={edge.id}>
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={active ? 'rgba(167, 243, 208, 0.88)' : 'rgba(255,255,255,0.18)'}
                        strokeWidth={active ? 2.4 : 1.2}
                      />
                      {active && (
                        <text
                          x={(from.x + to.x) / 2}
                          y={(from.y + to.y) / 2 - 6}
                          textAnchor="middle"
                          className="fill-emerald-100 text-[10px]"
                        >
                          {edge.type}
                        </text>
                      )}
                    </g>
                  )
                })}
                {visibleNodes.map((node) => {
                  const palette = nodeColor[node.type]
                  const active = node.id === selectedNode.id
                  const radius = node.type === 'project' ? 34 : node.type === 'person' ? 28 : 22
                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNodeId(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedNodeId(node.id)
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={active ? radius + 7 : radius}
                        fill={active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.025)'}
                        stroke={active ? palette.stroke : 'rgba(255,255,255,0.08)'}
                        strokeWidth={active ? 2 : 1}
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={palette.fill}
                        stroke={palette.stroke}
                        strokeWidth={active ? 3 : 1.5}
                        filter={active ? 'url(#node-glow)' : undefined}
                      />
                      <text x={node.x} y={node.y + 4} textAnchor="middle" className="fill-zinc-950 text-[11px] font-semibold">
                        {palette.label.slice(0, 1)}
                      </text>
                      <text
                        x={node.x}
                        y={node.y + radius + 18}
                        textAnchor="middle"
                        className={cn('fill-zinc-100 text-[12px] font-medium', active && 'font-semibold')}
                      >
                        {node.title.length > 24 ? `${node.title.slice(0, 24)}...` : node.title}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </section>

          <Tabs defaultValue="timeline" className="rounded-lg border border-border bg-card p-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timeline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="project" className="gap-2">
                <Target className="h-4 w-4" />
                Project Lens
              </TabsTrigger>
              <TabsTrigger value="replay" className="gap-2">
                <History className="h-4 w-4" />
                Replay
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <div className="space-y-3">
                {atlas.timeline.map((moment, index) => (
                  <button
                    key={moment.id}
                    onClick={() => setSelectedNodeId(moment.nodeIds[0])}
                    className="grid w-full grid-cols-[92px_1fr] gap-3 rounded-lg border border-border bg-secondary/25 p-3 text-left hover:border-cyan-300/40"
                  >
                    <div className="text-xs text-muted-foreground">{moment.date}</div>
                    <div className="relative">
                      {index < atlas.timeline.length - 1 && <div className="absolute -left-[18px] top-7 h-[calc(100%+12px)] w-px bg-border" />}
                      <div className="flex items-start gap-3">
                        <CircleDot className="mt-0.5 h-4 w-4 text-cyan-200" />
                        <div>
                          <p className="text-sm font-semibold">{moment.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{moment.description}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="project" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-border bg-secondary/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge className="bg-emerald-300 text-zinc-950">{selectedProject.status}</Badge>
                      <h3 className="mt-3 text-xl font-semibold">{selectedProject.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedProject.summary}</p>
                    </div>
                    <Button size="sm" className="gap-2" onClick={copyProjectContext}>
                      <ClipboardCopy className="h-4 w-4" />
                      {copied ? 'Copied' : 'Export'}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {projectLensSections.map(([label, ids, Icon]) => (
                      <div key={label} className="rounded-lg border border-border bg-card/70 p-3">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="h-4 w-4 text-emerald-200" />
                          {label}
                        </p>
                        <div className="mt-2 space-y-2">
                          {ids.map((id) => {
                            const node = findNode(atlas.nodes, id)
                            if (!node) return null
                            return (
                              <button key={id} onClick={() => setSelectedNodeId(id)} className="block text-left text-xs leading-relaxed text-muted-foreground hover:text-foreground">
                                {node.title}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/25 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-amber-200" />
                    Insight Panel
                  </h3>
                  <div className="mt-3 space-y-3">
                    {[
                      ['Recurring theme', 'Agent memory, context engineering, and productized AI collaboration appear across 5 chats.'],
                      ['Evolving preference', 'The user prefers a product with emotional and portfolio value over a narrow utility plugin.'],
                      ['Next move', 'Ship a graph-first demo before hardening automatic extraction.'],
                    ].map(([title, detail]) => (
                      <div key={title} className="rounded-lg border border-border bg-card/70 p-3">
                        <p className="text-sm font-medium">{title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="replay" className="mt-4">
              <div className="grid gap-3 lg:grid-cols-5">
                {atlas.timeline.map((moment, index) => (
                  <button
                    key={moment.id}
                    onClick={() => setSelectedNodeId(moment.nodeIds[0])}
                    className="rounded-lg border border-border bg-secondary/25 p-3 text-left hover:border-pink-300/40"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">Step {index + 1}</Badge>
                      {index < atlas.timeline.length - 1 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : <WandSparkles className="h-4 w-4 text-pink-200" />}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{moment.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{moment.description}</p>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <PanelRight className="h-4 w-4 text-amber-200" />
                  Node Detail
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Evidence and provenance for the selected memory object.</p>
              </div>
              <Badge className={cn('border', nodeColor[selectedNode.type].bg, nodeColor[selectedNode.type].text)} variant="outline">
                {nodeColor[selectedNode.type].label}
              </Badge>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-secondary/25 p-4">
              <h3 className="text-lg font-semibold">{selectedNode.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedNode.summary}</p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confidence</span>
                  <span>{Math.round(selectedNode.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${selectedNode.confidence * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                <div className="mt-2 space-y-2">
                  {selectedNode.evidence.map((item) => (
                    <div key={item} className="rounded-lg border border-border bg-secondary/20 p-3 text-xs leading-relaxed text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Connected edges</p>
                <div className="mt-2 space-y-2">
                  {relatedEdges.map((edge) => {
                    const other = findNode(atlas.nodes, edge.from === selectedNode.id ? edge.to : edge.from)
                    if (!other) return null
                    return (
                      <button
                        key={edge.id}
                        onClick={() => setSelectedNodeId(other.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-left text-xs hover:border-emerald-300/40"
                      >
                        <span>
                          <span className="text-muted-foreground">{edge.type}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                          <span>{other.title}</span>
                        </span>
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="h-4 w-4 text-cyan-200" />
              Source Chats
            </h2>
            <ScrollArea className="mt-3 h-[420px] pr-3">
              <div className="space-y-3">
                {selectedChats.map((chat) => (
                  <div key={chat.id} className="rounded-lg border border-border bg-secondary/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{chat.title}</p>
                      <Badge variant="secondary" className="text-[10px]">{chat.surface}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="text-foreground">User:</span> {chat.userMessage}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="text-foreground">AI:</span> {chat.aiMessage}
                    </p>
                    {(chat.sessionId || chat.cwd || chat.transcriptPath) && (
                      <div className="mt-3 space-y-1 rounded-md border border-border bg-card/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
                        {chat.sessionId && <p>Session: {chat.sessionId}</p>}
                        {chat.cwd && <p>Workspace: {chat.cwd}</p>}
                        {chat.transcriptPath && <p>Transcript: {chat.transcriptPath}</p>}
                      </div>
                    )}
                  </div>
                ))}
                {selectedChats.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No source chat is attached to this memory node yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>
        </aside>
      </div>
    </main>
  )
}
