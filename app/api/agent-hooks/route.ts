import { NextResponse } from 'next/server'
import { normalizeAgentHook } from '@/lib/agent-hooks/normalizers'
import { bufferAgentHook } from '@/lib/agent-hooks/session-buffer'
import { addCaptureDiagnostic, ingestServerEvent } from '@/lib/server/second-brain-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)

  if (!raw) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const normalized = normalizeAgentHook(raw)
  const buffered = bufferAgentHook(normalized)

  if (!buffered.ready || !buffered.payload) {
    await addCaptureDiagnostic({
      type: 'agent-hook',
      surface: normalized.surface,
      message: buffered.reason || 'Agent hook buffered.',
      captureMethod: normalized.captureMethod,
    })

    return NextResponse.json(
      {
        accepted: true,
        buffered: true,
        reason: buffered.reason,
        provider: normalized.provider,
        sessionId: buffered.sessionId,
      },
      { headers: corsHeaders },
    )
  }

  const event = await ingestServerEvent(buffered.payload)
  await addCaptureDiagnostic({
    type: 'ingest-success',
    surface: normalized.surface,
    message: `Captured ${normalized.surface} ${event.promptPurpose} prompt as ${event.memoryRepresentation}.`,
    captureMethod: normalized.captureMethod,
  })

  return NextResponse.json(
    {
      accepted: true,
      buffered: false,
      provider: normalized.provider,
      sessionId: buffered.sessionId,
      promptPurpose: event.promptPurpose,
      memoryRepresentation: event.memoryRepresentation,
      event,
    },
    { headers: corsHeaders },
  )
}
