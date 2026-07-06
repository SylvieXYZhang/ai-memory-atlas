import { NextResponse } from 'next/server'
import { atlasProjects, memoryEdges, memoryNodes, mockAiChats, timelineMoments } from '@/lib/memory-atlas/seed-data'
import { eventsToMemoryCandidates, eventsToMemoryGraph } from '@/lib/memory-atlas/extraction'
import { listMemoryCandidateReviews, listServerEvents, readToolPromptNotes } from '@/lib/server/second-brain-events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET() {
  const [events, reviews, toolNotes] = await Promise.all([
    listServerEvents(),
    listMemoryCandidateReviews(),
    readToolPromptNotes(),
  ])
  const candidates = eventsToMemoryCandidates(events, reviews)
  const liveGraph = eventsToMemoryGraph(events, reviews)
  const toolNoteCount = (toolNotes.match(/^## /gm) || []).length

  return NextResponse.json(
    {
      nodes: [...memoryNodes, ...liveGraph.nodes],
      edges: [...memoryEdges, ...liveGraph.edges],
      chats: [...liveGraph.chats, ...mockAiChats],
      projects: atlasProjects,
      timeline: timelineMoments,
      candidates,
      liveEventCount: liveGraph.chats.length,
      toolNoteCount,
    },
    { headers: corsHeaders },
  )
}
