# AI Memory Atlas Development Plan

## 1. Project Positioning

`echowork-v0` should be repositioned from a voice-first second brain or chat capture plugin into an AI Memory Atlas:

> A visual memory system that turns long-term human-AI interactions into an explorable map of projects, decisions, ideas, tasks, artifacts, and evolving preferences.

Chinese positioning:

> 一个把用户和 AI 长期共同工作、共同思考、共同创造的轨迹可视化的个人记忆图谱，让散落在聊天、agent traces、工具调用和作品里的 AI 使用痕迹，沉淀成可回看、可理解、可复用的个人资产。

The product is not mainly "help an agent read the previous chat." The stronger product value is:

- Capture how a person works with AI over time.
- Structure raw AI interactions into durable memory objects.
- Visualize the growth of projects, ideas, decisions, tasks, artifacts, and preferences.
- Export project context back to agents when the user wants to continue working.

## 2. Product North Star

North Star:

> The user can open the product and immediately understand how their AI collaboration history is becoming a growing personal asset.

Primary aha moment:

> "I can see how my ideas, projects, decisions, tasks, and outputs evolved across many AI conversations."

Secondary aha moment:

> "I can give a project's memory back to an agent so it can continue from real context."

## 3. Target Users

Primary users:

- AI-heavy builders who use ChatGPT, Claude, Cursor, Codex, OpenClaw, or similar tools daily.
- PMs, founders, designers, researchers, and engineers whose thinking is scattered across many AI chats.
- Users preparing a portfolio or job application who want to show how their product thinking evolved.

Initial demo audience:

- Hiring managers or reviewers evaluating agent product sense.
- Users who already feel pain from fragmented AI interaction history.

## 4. Core Product Layers

### Layer 1: Capture

Goal: collect AI interaction evidence without making capture the product's main story.

Inputs:

- Browser extension capture from supported AI pages.
- Manual paste of chat transcripts.
- Existing local API ingestion.
- Future: Codex / agent run traces, tool calls, artifacts, accept/reject signals.

Current repo assets to keep:

- `extension/`
- `app/api/ingest/route.ts`
- `app/api/events/route.ts`
- `.second-brain` local JSONL event pipeline

### Layer 2: Structure

Goal: transform raw interaction records into typed memory objects and graph relationships.

Memory node types:

- `project`
- `idea`
- `decision`
- `task`
- `artifact`
- `question`
- `preference`
- `failure`
- `tool`
- `person`

Edge types:

- `belongs_to`
- `generated_from`
- `led_to`
- `supports`
- `contradicts`
- `resolved_by`
- `revisited_in`

Minimum schema:

```ts
type MemoryNode = {
  id: string
  type:
    | 'project'
    | 'idea'
    | 'decision'
    | 'task'
    | 'artifact'
    | 'question'
    | 'preference'
    | 'failure'
    | 'tool'
    | 'person'
  title: string
  summary: string
  evidence: string[]
  confidence: number
  createdAt: number
  updatedAt: number
}

type MemoryEdge = {
  id: string
  from: string
  to: string
  type:
    | 'belongs_to'
    | 'generated_from'
    | 'led_to'
    | 'supports'
    | 'contradicts'
    | 'resolved_by'
    | 'revisited_in'
  evidence?: string
}
```

### Layer 3: Visualize

Goal: make long-term AI memory feel alive, inspectable, and useful.

Core views:

1. Graph View
   - Shows typed memory nodes and relationships.
   - Supports filtering by type, source, project, and time range.
   - Starts with curated demo data plus captured local events.

2. Timeline View
   - Shows how ideas and projects evolved over time.
   - Emphasizes "idea growth" rather than raw chat chronology.

3. Project Lens
   - Aggregates all memory around one project.
   - Shows related chats, decisions, open questions, artifacts, next actions, and exportable agent context.

4. Insight Panel
   - Summarizes repeated themes, durable preferences, unresolved questions, and suggested next moves.

5. Replay Mode
   - Replays how a project or idea developed from first prompt to current direction.
   - This is a high-emotion demo feature and should be treated as a product differentiator.

## 5. MVP Scope

The MVP should be semi-automatic and demoable. Do not attempt a fully autonomous knowledge graph first.

### In Scope

- Manual paste and browser extension ingestion.
- Rule-based extraction plus optional LLM extraction adapter.
- Typed memory nodes and edges persisted locally.
- Graph View, Timeline View, and Project Lens.
- Seeded demo dataset based on the project's own evolution.
- Export Project Context button.

### Out of Scope

- Full multi-agent automation.
- Team collaboration.
- Cross-device sync.
- Fine-grained permission management.
- Fully reliable automatic graph ontology.
- Production-grade vector memory.

## 6. Roadmap

### Milestone 0: Repositioning and IA Cleanup

Objective:

Make the app clearly present itself as AI Memory Atlas.

Work:

- Rename product language from "Second Brain" / "VoiceAgent" to "AI Memory Atlas."
- Keep voice as an optional capture method, not the center of the product.
- Replace home page information architecture with:
  - Memory Graph
  - Timeline
  - Project Lens
  - Insight Panel
  - Capture Inbox
- Update demo copy and seeded data around the user's real project evolution.

Acceptance criteria:

- A first-time viewer understands the product in 30 seconds.
- The first screen is a memory atlas, not a voice assistant.
- Existing ingestion still works.

### Milestone 1: Memory Object Model

Objective:

Introduce durable memory nodes and edges as first-class domain objects.

Work:

- Add `MemoryNode` and `MemoryEdge` types.
- Add extraction result type for:
  - projects
  - ideas
  - decisions
  - tasks
  - artifacts
  - questions
  - preferences
- Add deterministic extraction fallback for local demo reliability.
- Persist graph data separately from raw capture records.
- Preserve provenance back to source events.

Acceptance criteria:

- A captured interaction can produce one or more typed nodes.
- Nodes retain evidence from the original prompt/answer.
- Edges can represent project membership and idea evolution.

### Milestone 2: Graph View MVP

Objective:

Make the memory graph visible and explorable.

Work:

- Build a graph canvas or graph panel using existing React UI.
- Display node type, title, confidence, and source count.
- Add node type filters.
- Add selected node detail panel with evidence.
- Use stable layout for seeded demo graph.

Acceptance criteria:

- Users can inspect how projects, ideas, decisions, tasks, and artifacts connect.
- Clicking a node reveals source evidence.
- The graph is meaningful with seeded demo data even before live capture.

### Milestone 3: Timeline and Replay

Objective:

Show memory growth over time.

Work:

- Add timeline grouping by day/project.
- Promote key events: first mention, decision made, artifact created, task completed, revisited topic.
- Build Replay Mode for one project.
- Start with the `echowork-v0` repositioning story as the demo replay.

Acceptance criteria:

- A viewer can see an idea evolve across multiple interactions.
- Replay Mode tells a clear product story without needing explanation.

### Milestone 4: Project Lens

Objective:

Turn scattered memory into actionable project context.

Work:

- Add project detail route or panel.
- Show:
  - summary
  - related chats
  - key decisions
  - open questions
  - active tasks
  - artifacts
  - useful context for agent
- Add `Export Project Context`.

Acceptance criteria:

- A user can open one project and understand its current state.
- Exported context is concise enough to paste into an agent.

### Milestone 5: Insight Panel

Objective:

Surface long-term patterns and suggested next moves.

Work:

- Aggregate recurring topics.
- Detect repeated project themes.
- Detect unresolved questions.
- Summarize evolving user preferences.
- Generate next-move suggestions with confidence labels.

Acceptance criteria:

- The insight panel gives useful summaries from multiple interactions.
- Suggestions distinguish strong evidence from weak guesses.

### Milestone 6: Capture Hardening

Objective:

Make capture reliable enough for a portfolio demo.

Work:

- Keep current extension capture path.
- Improve diagnostics for DOM, network, and ingest failures.
- Add manual transcript paste as the guaranteed fallback.
- Add sample transcript import for demo reset.

Acceptance criteria:

- The demo works even when third-party AI pages change DOM structure.
- Capture failures are visible and recoverable.

## 7. Recommended Build Order

Build in this order:

1. Product copy and home IA.
2. Domain types and seeded memory graph data.
3. Graph View.
4. Project Lens.
5. Timeline.
6. Replay Mode.
7. Extraction pipeline.
8. Capture hardening.
9. Insight Panel.
10. Agent context export polish.

Reasoning:

- The product's value is visual and narrative, so the demo should become graph-first early.
- Capture already exists well enough for a proof.
- Fully automatic extraction can lag behind the UI if seeded demo data and deterministic extraction are solid.

## 8. Technical Plan

### Data Model

Add a new graph domain layer:

- `lib/memory-atlas/types.ts`
- `lib/memory-atlas/seed-data.ts`
- `lib/memory-atlas/extraction.ts`
- `lib/memory-atlas/graph.ts`
- `lib/memory-atlas/storage.ts`

Keep raw capture files:

- `.second-brain/raw-ai-io.jsonl`
- `.second-brain/ingestion-records.jsonl`
- `.second-brain/events.json`

Add graph files:

- `.second-brain/memory-nodes.json`
- `.second-brain/memory-edges.json`

### UI Structure

Recommended app routes:

- `/` Atlas dashboard
- `/projects/[id]` Project Lens
- `/timeline` Timeline View
- `/capture` Capture Inbox
- `/mock-ai` local capture test page, keep existing

Recommended components:

- `components/memory-atlas/atlas-dashboard.tsx`
- `components/memory-atlas/memory-graph.tsx`
- `components/memory-atlas/timeline-view.tsx`
- `components/memory-atlas/project-lens.tsx`
- `components/memory-atlas/insight-panel.tsx`
- `components/memory-atlas/capture-inbox.tsx`
- `components/memory-atlas/replay-mode.tsx`

### Extraction Strategy

MVP extraction should use a two-step path:

1. Deterministic extractor:
   - keyword and pattern-based
   - reliable for demo
   - no external API required

2. LLM extractor adapter:
   - optional
   - returns the same structured schema
   - can improve real-world transcripts later

### Visualization Strategy

Use a simple custom graph first:

- SVG or canvas with fixed initial layout.
- Force simulation can be added later.
- Prioritize clarity over visual complexity.

Graph should communicate:

- node type
- project cluster
- relationship direction
- evidence count
- recency

## 9. Demo Story

The best demo story is the product's own creation:

1. The user explores agent memory for a DeepSeek application.
2. The idea shifts from a context bridge to a memory harness.
3. The product direction evolves into AI Memory Atlas.
4. The graph shows related projects, decisions, open questions, and artifacts.
5. Replay Mode shows how the idea grew.
6. Export Project Context gives an agent enough context to continue development.

This creates a strong meta-demo:

> The product demonstrates its own value by visualizing how it was born.

## 10. Success Metrics

MVP metrics:

- Time to understand product value: under 30 seconds.
- Time to first useful graph: under 2 minutes.
- Number of extracted memory nodes per meaningful conversation.
- Percentage of nodes with evidence.
- Project context export usage.

Qualitative signals:

- User says: "I forgot I had worked through that."
- User can explain how an idea evolved.
- User trusts the graph because evidence is visible.
- User wants to keep using it after the demo.

## 11. Risks and Mitigations

Risk: product becomes a generic knowledge graph.

Mitigation:

- Anchor every node in AI collaboration evidence.
- Emphasize project evolution, decisions, and replay.

Risk: automatic extraction is unreliable.

Mitigation:

- Start semi-automatic.
- Keep evidence visible.
- Use confidence scores.
- Let users edit or promote candidates later.

Risk: capture from third-party AI apps breaks.

Mitigation:

- Keep manual paste fallback.
- Keep local mock AI page.
- Treat extension as a proof point, not the only input.

Risk: UI becomes visually impressive but not useful.

Mitigation:

- Every graph node must answer: what is this, where did it come from, why does it matter, what can I do next?

## 12. Immediate Next Sprint

Recommended one-week sprint:

1. Update product language to AI Memory Atlas.
2. Add memory node and edge schemas.
3. Add seeded memory graph for the `echowork-v0` repositioning story.
4. Replace home page with atlas dashboard shell.
5. Build first Graph View with node detail panel.
6. Add Project Lens for "AI Memory Atlas / echowork-v0."
7. Add Export Project Context for that project.

Sprint demo acceptance:

- Opening `/` shows a graph-first AI Memory Atlas dashboard.
- The seeded project story is understandable without narration.
- At least one captured or pasted event can appear as a memory candidate.
- The user can export project context for agent continuation.
