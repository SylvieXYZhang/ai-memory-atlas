import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const prompt = body?.messages?.findLast?.((message: { role?: string }) => message.role === 'user')?.content
    || body?.messages?.[body?.messages?.length - 1]?.content
    || 'No prompt provided.'

  return NextResponse.json({
    id: `mock-${Date.now()}`,
    choices: [
      {
        message: {
          role: 'assistant',
          content: `Second Brain captured this mock AI answer for: ${prompt}. The next step is to link this answer to projects, repeated topics, and user profile signals.`,
        },
      },
    ],
  })
}
