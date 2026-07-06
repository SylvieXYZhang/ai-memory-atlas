import { NextResponse } from 'next/server'
import { listIngestionRecords, listRawCaptureRecords } from '@/lib/server/second-brain-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const [raw, ingestion] = await Promise.all([
    listRawCaptureRecords(),
    listIngestionRecords(),
  ])
  return NextResponse.json({ raw, ingestion }, { headers: corsHeaders })
}
