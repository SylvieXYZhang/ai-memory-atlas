import { NextResponse } from 'next/server'
import { ingestServerEvent } from '@/lib/server/second-brain-events'
import type { IngestPayload } from '@/lib/second-brain'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  let payload: IngestPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  if (!payload.userInput && !payload.aiOutput) {
    return NextResponse.json({ error: 'userInput or aiOutput is required' }, { status: 400, headers: corsHeaders })
  }

  const event = await ingestServerEvent({
    ...payload,
    source: payload.source || 'api',
  })

  return NextResponse.json({
    event,
    promptPurpose: event.promptPurpose,
    memoryRepresentation: event.memoryRepresentation,
    graphEligible: event.promptPurpose !== 'tool',
  }, { headers: corsHeaders })
}
