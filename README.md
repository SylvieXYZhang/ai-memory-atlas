# AI Memory Atlas

AI Memory Atlas turns long-term human-AI collaboration into a visual personal memory graph.

Instead of treating every AI chat as another lost transcript, it captures prompts and AI interactions, extracts durable memory objects, and visualizes how projects, ideas, decisions, tasks, artifacts, questions, and preferences evolve over time.

> A visual memory system for making AI collaboration history explorable, reusable, and personally owned.

## Why It Exists

People now work with AI across ChatGPT, Claude, Cursor, Codex, OpenClaw, and many other tools. Useful judgments, project decisions, prompts, and artifacts are scattered across separate chat histories. They rarely become a durable asset.

AI Memory Atlas explores a different product shape:

- Capture the user's AI collaboration trail.
- Structure raw interactions into typed memory objects.
- Visualize long-term thinking as a growing graph and timeline.
- Export project context back to agents when work should continue.

## Core Features

- **Memory Graph**: An explorable graph of projects, ideas, decisions, tasks, artifacts, questions, preferences, tools, and source chats.
- **Timeline**: A chronological view of how ideas and projects evolved.
- **Project Lens**: A project-centered view with decisions, tasks, artifacts, open questions, and source chats.
- **Replay Mode**: A narrative view that shows how an idea grew across multiple AI conversations.
- **Prompt Capture Extension**: A Chrome extension that captures prompts submitted on supported AI pages.
- **Manual Capture**: A local capture form for adding user prompts and AI responses directly to the graph.
- **Memory Inbox**: An accept/edit/reject queue so captured interactions become long-term memory only after review.
- **Agent Context Export**: A compact project context export that can be pasted into another AI or agent workflow.

## Privacy Boundary

The browser extension is intentionally narrow:

- It does **not** monitor global keyboard input.
- It only runs on supported AI pages declared in `extension/manifest.json`.
- It only listens to editable AI prompt boxes such as `textarea`, `contenteditable`, and `role="textbox"`.
- It captures when the user submits a prompt with Enter, a send button, or when the prompt box clears after submission.
- It stores data locally through the local Next.js app.

AI response capture exists as an optional DOM/network enhancement, but prompt-only capture is the default stable path.

## Architecture

```txt
AI page prompt input
  -> Chrome extension content script
  -> /api/ingest
  -> prompt purpose classifier
       -> tool prompts: .second-brain/tool-notes.md
       -> knowledge prompts: graph candidates
       -> thinking prompts: thinking-map candidates
  -> .second-brain/raw-ai-io.jsonl
  -> .second-brain/ingestion-records.jsonl
  -> .second-brain/events.json
  -> /api/atlas
  -> Memory Graph UI
```

Key modules:

- `components/memory-atlas/atlas-dashboard.tsx`: Main graph-first product UI.
- `lib/memory-atlas/seed-data.ts`: Seed graph used for first-run demo value.
- `lib/memory-atlas/prompt-classifier.ts`: Classifies captured prompts as tool, knowledge, or thinking interactions.
- `lib/memory-atlas/extraction.ts`: Deterministic event-to-memory extraction.
- `app/api/ingest/route.ts`: Local capture API.
- `app/api/agent-hooks/route.ts`: Local Codex and Claude Code hook capture API.
- `app/api/atlas/route.ts`: Graph data API.
- `extension/content-script.js`: Prompt capture and page diagnostics.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/Radix UI components
- Lucide icons
- Chrome Extension Manifest V3

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:3000
```

Build:

```bash
npm run build
```

## Browser Extension

1. Start the local app at `http://127.0.0.1:3000`.
2. Open Chrome or Edge extension management:

```txt
chrome://extensions
```

3. Enable Developer Mode.
4. Choose **Load unpacked**.
5. Select the `extension/` folder.
6. Open ChatGPT, Claude, Cursor, or another supported AI page.
7. Type in the AI input box and submit a prompt.
8. Return to AI Memory Atlas and refresh or wait for sync.

Diagnostics are available at:

```txt
http://127.0.0.1:3000/api/capture-status
```

Useful diagnostic messages:

- `AI Memory Atlas extension content script loaded`: the content script injected.
- `Detected text in AI prompt input`: the prompt box was recognized.
- `Captured prompt from ...`: the submitted prompt was sent to `/api/ingest`.
- `Local ingest API unavailable`: the local app is not reachable.

## API Capture

You can also add an interaction directly:

```bash
curl -X POST http://127.0.0.1:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "surface": "ChatGPT",
    "userInput": "I want to turn AI chats into a personal memory graph.",
    "aiOutput": "Extract projects, ideas, decisions, tasks, artifacts, questions, and preferences.",
    "source": "api",
    "captureMethod": "webhook"
  }'
```

Then inspect graph data:

```txt
http://127.0.0.1:3000/api/atlas
```

## Agent Hooks Capture

Codex and Claude Code can stream local agent events into the same capture pipeline as the browser extension.

1. Start the local app:

```bash
npm run dev
```

2. Wire the relevant CLI hook to one of the local bridge scripts:

```txt
scripts/hooks/codex-hook.js
scripts/hooks/claude-code-hook.js
```

3. Use the examples as starting points:

```txt
docs/codex-hooks.example.json
docs/claude-code-hooks.example.json
```

4. Run a Codex or Claude Code session, then open AI Memory Atlas. Completed prompt/response pairs appear in Memory Inbox as editable candidates before entering the graph.

The hook endpoint is:

```txt
http://127.0.0.1:3000/api/agent-hooks
```

Set `AI_MEMORY_ATLAS_HOOK_URL` if the local app runs on a different host or port.

## Current Status

This is an early local-first prototype. It already demonstrates the full loop:

```txt
Capture -> Review -> Structure -> Visualize -> Reuse
```

Captured interactions first appear as editable memory candidates. Accepted candidates enter the main graph; rejected candidates stay out of long-term memory. The graph extraction is deterministic and intentionally conservative. A production version would add stronger source attribution, merge suggestions, and optional LLM-assisted extraction.

## Prompt Purpose Model

AI Memory Atlas does not treat every AI conversation as graph-worthy memory:

- **Tool prompts** ask AI to deliver a concrete result, such as drafting an email, polishing text, formatting data, or generating an image. These are stored as markdown notes in `.second-brain/tool-notes.md` because they mostly reveal result preferences and workflow habits.
- **Knowledge prompts** ask AI to retrieve, explain, compare, or structure external knowledge. These become knowledge graph candidates because they expose what the user knows, does not know, and is trying to learn.
- **Thinking prompts** ask AI to co-think, critique, brainstorm, or extend the user's own framework. These become thinking-map candidates: graph objects that emphasize assumptions, values, open questions, and the user's next knowledge boundary.

The hook and ingest pipeline classifies a completed prompt/response pair before graph extraction. Tool prompts still keep raw provenance, but they do not enter `events.json` or the Memory Inbox. Knowledge and thinking prompts enter review before graph promotion.

## Roadmap

- User-confirmed memory promotion.
- Node editing, merging, and deletion.
- Project-specific memory export templates.
- Better AI response capture.
- Local-first encrypted storage.
- Optional vector search over source chats.
- Browser extension settings for domain-level consent.
- Desktop companion capture layer.

## License

MIT. See [LICENSE](LICENSE).
