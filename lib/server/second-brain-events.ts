import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import {
  createIngestionRecord,
  createMemoryEvent,
  createRawCaptureRecord,
  mergeEvents,
  type IngestPayload,
  type IngestionRecord,
  type MemoryEvent,
  type RawCaptureRecord,
} from '@/lib/second-brain'
import { shouldEnterGraph } from '@/lib/memory-atlas/prompt-classifier'
import type { MemoryCandidateReview, MemoryCandidateStatus, MemoryNodeType } from '@/lib/memory-atlas/types'

const DATA_DIR = path.join(process.cwd(), '.second-brain')
const DATA_FILE = path.join(DATA_DIR, 'events.json')
const DIAGNOSTICS_FILE = path.join(DATA_DIR, 'capture-diagnostics.json')
const RAW_CAPTURE_FILE = path.join(DATA_DIR, 'raw-ai-io.jsonl')
const INGESTION_FILE = path.join(DATA_DIR, 'ingestion-records.jsonl')
const MEMORY_REVIEW_FILE = path.join(DATA_DIR, 'memory-candidate-reviews.json')
const TOOL_NOTES_FILE = path.join(DATA_DIR, 'tool-notes.md')

export interface CaptureDiagnostic {
  id: string
  type: 'heartbeat' | 'dom-scan' | 'network-event' | 'ingest-success' | 'ingest-error' | 'agent-hook'
  surface?: string
  url?: string
  message: string
  captureMethod?: 'dom' | 'network' | 'codex-hook' | 'claude-code-hook'
  timestamp: number
}

async function readStoredEvents(): Promise<MemoryEvent[]> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as MemoryEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeStoredEvents(events: MemoryEvent[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(events, null, 2), 'utf8')
}

async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const existing = await readFile(filePath, 'utf8').catch(() => '')
  await writeFile(filePath, `${existing}${JSON.stringify(value)}\n`, 'utf8')
}

function markdownEscape(value?: string) {
  return (value?.trim() || 'Not captured.').replace(/\r\n/g, '\n')
}

async function appendToolMarkdown(event: MemoryEvent): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const existing = await readFile(TOOL_NOTES_FILE, 'utf8').catch(() => '')
  const note = [
    existing ? '' : '# Tool Prompt Notes',
    '',
    `## ${new Date(event.capturedAt).toISOString()} - ${event.surface}`,
    '',
    `- Purpose: ${event.promptPurpose}`,
    `- Representation: ${event.memoryRepresentation}`,
    `- Classification: ${(event.classificationConfidence * 100).toFixed(0)}% - ${event.classificationRationale}`,
    event.sessionId ? `- Session: ${event.sessionId}` : '',
    event.cwd ? `- Workspace: ${event.cwd}` : '',
    '',
    '### User Prompt',
    '',
    markdownEscape(event.userInput),
    '',
    '### AI Response',
    '',
    markdownEscape(event.aiOutput),
    '',
  ].filter((line) => line !== '').join('\n')
  await writeFile(TOOL_NOTES_FILE, `${existing}${note}\n`, 'utf8')
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T)
  } catch {
    return []
  }
}

export async function listServerEvents(): Promise<MemoryEvent[]> {
  return readStoredEvents()
}

export async function ingestServerEvent(payload: IngestPayload): Promise<MemoryEvent> {
  const rawRecord = createRawCaptureRecord(payload)
  const event = createMemoryEvent(payload)
  const ingestionRecord = createIngestionRecord(event, rawRecord)
  const existing = await readStoredEvents()
  await appendJsonLine(RAW_CAPTURE_FILE, rawRecord)
  await appendJsonLine(INGESTION_FILE, ingestionRecord)

  if (shouldEnterGraph(event)) {
    const merged = mergeEvents(existing, [event])
    await writeStoredEvents(merged)
  } else {
    await appendToolMarkdown(event)
  }

  return event
}

export async function clearServerEvents(): Promise<void> {
  await writeStoredEvents([])
  await writeFile(RAW_CAPTURE_FILE, '', 'utf8').catch(() => undefined)
  await writeFile(INGESTION_FILE, '', 'utf8').catch(() => undefined)
  await writeFile(TOOL_NOTES_FILE, '', 'utf8').catch(() => undefined)
}

export async function readToolPromptNotes(): Promise<string> {
  return readFile(TOOL_NOTES_FILE, 'utf8').catch(() => '')
}

export async function listRawCaptureRecords(): Promise<RawCaptureRecord[]> {
  return readJsonLines<RawCaptureRecord>(RAW_CAPTURE_FILE)
}

export async function listIngestionRecords(): Promise<IngestionRecord[]> {
  return readJsonLines<IngestionRecord>(INGESTION_FILE)
}

async function readMemoryCandidateReviews(): Promise<MemoryCandidateReview[]> {
  try {
    const raw = await readFile(MEMORY_REVIEW_FILE, 'utf8')
    const parsed = JSON.parse(raw) as MemoryCandidateReview[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeMemoryCandidateReviews(items: MemoryCandidateReview[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(MEMORY_REVIEW_FILE, JSON.stringify(items, null, 2), 'utf8')
}

export async function listMemoryCandidateReviews(): Promise<MemoryCandidateReview[]> {
  return readMemoryCandidateReviews()
}

export async function setMemoryCandidateReview(input: {
  id: string
  status: MemoryCandidateStatus
  title?: string
  type?: MemoryNodeType
  summary?: string
}): Promise<MemoryCandidateReview> {
  const existing = await readMemoryCandidateReviews()
  const next: MemoryCandidateReview = {
    id: input.id,
    status: input.status,
    title: input.title,
    type: input.type,
    summary: input.summary,
    updatedAt: Date.now(),
  }
  const merged = [next, ...existing.filter((item) => item.id !== input.id)]
  await writeMemoryCandidateReviews(merged)
  return next
}

async function readDiagnostics(): Promise<CaptureDiagnostic[]> {
  try {
    const raw = await readFile(DIAGNOSTICS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as CaptureDiagnostic[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDiagnostics(items: CaptureDiagnostic[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DIAGNOSTICS_FILE, JSON.stringify(items, null, 2), 'utf8')
}

export async function addCaptureDiagnostic(input: Omit<CaptureDiagnostic, 'id' | 'timestamp'>): Promise<CaptureDiagnostic> {
  const item: CaptureDiagnostic = {
    ...input,
    id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }
  const existing = await readDiagnostics()
  await writeDiagnostics([item, ...existing].slice(0, 80))
  return item
}

export async function listCaptureDiagnostics(): Promise<CaptureDiagnostic[]> {
  return readDiagnostics()
}

export async function clearCaptureDiagnostics(): Promise<void> {
  await writeDiagnostics([])
}
