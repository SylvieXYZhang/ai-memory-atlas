import { NextResponse } from 'next/server'
import {
  addCaptureDiagnostic,
  clearCaptureDiagnostics,
  listCaptureDiagnostics,
  type CaptureDiagnostic,
} from '@/lib/server/second-brain-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const diagnostics = await listCaptureDiagnostics()
  return NextResponse.json({ diagnostics }, { headers: corsHeaders })
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Partial<CaptureDiagnostic> | null

  if (!payload?.type || !payload.message) {
    return NextResponse.json({ error: 'type and message are required' }, { status: 400, headers: corsHeaders })
  }

  const diagnostic = await addCaptureDiagnostic({
    type: payload.type,
    surface: payload.surface,
    url: payload.url,
    message: payload.message,
    captureMethod: payload.captureMethod,
  })

  return NextResponse.json({ diagnostic }, { headers: corsHeaders })
}

export async function DELETE() {
  await clearCaptureDiagnostics()
  return NextResponse.json({ ok: true }, { headers: corsHeaders })
}
