'use client'

import { StickyNote, Clock, Link2, BookOpen, Hash, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NoteRecord, SearchResult } from '@/lib/types'

interface NoteDisplayProps {
  currentNote: NoteRecord
  relatedNotes: SearchResult[]
  onPublish?: (noteId: string) => void
  isPublishing?: boolean
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function SimilarityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-related rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
        {Math.round(value)}%
      </span>
    </div>
  )
}

export function NoteDisplay({ currentNote, relatedNotes, onPublish, isPublishing }: NoteDisplayProps) {
  const wordCount = currentNote.text.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Current note — verbatim transcript */}
      <Card className="border-note/40 bg-note/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-md bg-note/20 flex items-center justify-center">
              <StickyNote className="w-4 h-4 text-note" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-note">Note saved</span>
                <Badge variant="outline" className="text-xs border-note/30 text-note/80 bg-note/10">
                  verbatim
                </Badge>
              </div>

              {/* The exact words the user said */}
              <blockquote className="text-foreground leading-relaxed text-base border-l-2 border-note/50 pl-3">
                {currentNote.text}
              </blockquote>

              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(currentNote.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  <span className="font-mono">{currentNote.id.slice(0, 8)}</span>
                </span>
              </div>

              {/* Publish button */}
              {onPublish && (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onPublish(currentNote.id)}
                    disabled={isPublishing}
                    className="bg-research hover:bg-research/90 text-research-foreground gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {isPublishing ? 'Publishing...' : 'Publish as Draft'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Semantic connections */}
      {relatedNotes.length > 0 ? (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 px-1">
            <Link2 className="w-4 h-4 text-related" />
            <h3 className="text-sm font-semibold text-foreground">Semantic connections</h3>
            <Badge
              variant="outline"
              className="text-xs border-related/40 text-related bg-related/10 ml-auto"
            >
              {relatedNotes.length} linked
            </Badge>
          </div>

          {/* Connection line visual */}
          <div className="relative">
            {/* Vertical connector */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-note/60 via-related/40 to-transparent" />

            <ScrollArea className="max-h-80">
              <div className="space-y-2 pl-10 pr-1">
                {relatedNotes.map((result, index) => (
                  <div key={result.note.id} className="relative">
                    {/* Horizontal connector dot */}
                    <div className={cn(
                      "absolute -left-6 top-4 w-2 h-2 rounded-full border-2 border-related",
                      index === 0 ? "bg-related" : "bg-background"
                    )} />
                    {/* Horizontal line */}
                    <div className="absolute -left-[18px] top-[18px] w-4 h-px bg-related/40" />

                    <Card className="border-related/20 bg-related/5 hover:bg-related/10 transition-colors">
                      <CardContent className="px-4 py-3">
                        <p className="text-sm text-foreground/85 leading-relaxed">
                          {result.note.text}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(result.note.timestamp)}
                          </span>
                        </div>
                        <SimilarityBar value={result.similarity} />
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-4 rounded-lg border border-dashed border-border text-muted-foreground">
          <Link2 className="w-4 h-4 flex-shrink-0 opacity-50" />
          <div>
            <p className="text-sm font-medium">No connections yet</p>
            <p className="text-xs mt-0.5">
              Keep adding notes — connections appear automatically as your knowledge base grows.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
