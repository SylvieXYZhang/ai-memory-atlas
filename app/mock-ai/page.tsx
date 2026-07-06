'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function MockAiPage() {
  const [prompt, setPrompt] = useState('Use OpenClaw to inspect a workflow and return agent memory suggestions.')
  const [answer, setAnswer] = useState('')

  const sendMockPrompt = async () => {
    const response = await fetch('/api/mock-chat-completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    setAnswer(data.choices?.[0]?.message?.content || '')
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Mock AI Chat Page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is a local fixture for testing the Second Brain extension network hook.
        </p>
      </div>

      <article data-message-author-role="user" className="rounded-lg border border-border bg-card p-4">
        I want Second Brain to fetch user input and AI output automatically.
      </article>
      <article data-message-author-role="assistant" className="rounded-lg border border-border bg-card p-4">
        Use a browser extension content script for DOM capture, plus a page-level network hook for fetch/XHR AI responses.
      </article>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label className="text-sm font-medium">Prompt</label>
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <Button onClick={sendMockPrompt}>Simulate AI fetch</Button>
      </section>

      {answer && (
        <article data-message-author-role="assistant" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
          {answer}
        </article>
      )}
    </main>
  )
}
