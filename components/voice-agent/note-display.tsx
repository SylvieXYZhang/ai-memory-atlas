'use client'

import { StickyNote, Clock, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { NoteRecord, SearchResult } from '@/lib/types'

interface NoteDisplayProps {
  currentNote: NoteRecord
  relatedNotes: SearchResult[]
}

export function NoteDisplay({ currentNote, relatedNotes }: NoteDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Current note */}
      <Card className="border-note/30 bg-note/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-note" />
            <CardTitle className="text-lg text-note">Note Saved</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-foreground/90 leading-relaxed">{currentNote.text}</p>
          <div className="flex items-center gap-1.5 mt-4 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{currentNote.createdAt}</span>
          </div>
        </CardContent>
      </Card>

      {/* Related notes */}
      {relatedNotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-related" />
            <h3 className="text-lg font-medium">Related Ideas</h3>
            <Badge variant="secondary" className="text-xs">
              {relatedNotes.length} found
            </Badge>
          </div>

          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {relatedNotes.map((result, index) => (
                <Card 
                  key={result.note.id} 
                  className="border-related/20 bg-related/5 hover:bg-related/10 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground/80 text-sm line-clamp-3">
                          {result.note.text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {result.note.createdAt}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="shrink-0 border-related/50 text-related bg-related/10"
                      >
                        {Math.round(result.similarity)}% match
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {relatedNotes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No related notes found yet.</p>
          <p className="text-sm">Keep adding notes to build your knowledge base!</p>
        </div>
      )}
    </div>
  )
}
