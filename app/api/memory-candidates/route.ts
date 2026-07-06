import { NextResponse } from 'next/server'
import { setMemoryCandidateReview } from '@/lib/server/second-brain-events'
import type { MemoryCandidateStatus, MemoryNodeType } from '@/lib/memory-atlas/types'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const statuses = new Set<MemoryCandidateStatus>(['pending', 'accepted', 'rejected'])
const nodeTypes = new Set<MemoryNodeType>([
  'project',
  'idea',
  'decision',
  'task',
  'artifact',
  'question',
  'preference',
  'failure',
  'tool',
  'person',
])

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => null) as {
    id?: string
    status?: MemoryCandidateStatus
    title?: string
    type?: MemoryNodeType
    summary?: string
  } | null

  if (!payload?.id || !payload.status || !statuses.has(payload.status)) {
    return NextResponse.json({ error: 'id and valid status are required' }, { status: 400, headers: corsHeaders })
  }

  if (payload.type && !nodeTypes.has(payload.type)) {
    return NextResponse.json({ error: 'Invalid node type' }, { status: 400, headers: corsHeaders })
  }

  const review = await setMemoryCandidateReview({
    id: payload.id,
    status: payload.status,
    title: payload.title?.trim() || undefined,
    type: payload.type,
    summary: payload.summary?.trim() || undefined,
  })

  return NextResponse.json({ review }, { headers: corsHeaders })
}
