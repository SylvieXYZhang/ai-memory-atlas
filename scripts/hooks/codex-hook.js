#!/usr/bin/env node

const fs = require('node:fs')

const endpoint = process.env.AI_MEMORY_ATLAS_HOOK_URL || 'http://127.0.0.1:3000/api/agent-hooks'

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function textFromContent(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join('\n')
  if (!value || typeof value !== 'object') return ''
  return textFromContent(value.text || value.content || value.message || value.output || value.response)
}

function roleFromMessage(value) {
  if (!value || typeof value !== 'object') return ''
  return String(value.role || value.type || '').toLowerCase()
}

function transcriptPathFrom(payload) {
  return payload.transcript_path || payload.transcriptPath || payload.transcript?.path
}

function enrichFromTranscript(payload) {
  const transcriptPath = transcriptPathFrom(payload)
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return payload

  const raw = fs.readFileSync(transcriptPath, 'utf8')
  const records = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })

  const messages = records.flatMap((record) => Array.isArray(record.messages) ? record.messages : [record])
  const users = []
  const assistants = []

  messages.forEach((message) => {
    const role = roleFromMessage(message)
    const text = textFromContent(message.content || message.message || message.text)
    if (!text) return
    if (role.includes('user')) users.push(text)
    if (role.includes('assistant') || role.includes('response')) assistants.push(text)
  })

  return {
    ...payload,
    transcriptPath,
    userInput: payload.userInput || payload.prompt || users.at(-1),
    aiOutput: payload.aiOutput || payload.response || assistants.at(-1),
  }
}

async function main() {
  const input = await readStdin()
  const parsed = input.trim() ? JSON.parse(input) : {}
  const payload = enrichFromTranscript({
    provider: 'codex',
    ...parsed,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI Memory Atlas hook ingest failed: ${response.status} ${text}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
