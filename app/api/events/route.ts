import { NextResponse } from 'next/server'
import { clearServerEvents, listServerEvents } from '@/lib/server/second-brain-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const events = await listServerEvents()
  return NextResponse.json({ events }, { headers: corsHeaders })
}

export async function DELETE() {
  await clearServerEvents()
  return NextResponse.json({ ok: true }, { headers: corsHeaders })
}
