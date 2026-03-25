'use client'

import { useState } from 'react'
import { FileText, StickyNote, Clock, ChevronDown, ChevronUp, Send, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { NoteRecord, PublishRecord } from '@/lib/types'

interface HistoryPanelProps {
  notes: NoteRecord[]
  publishHistory: PublishRecord[]
  onPublishNote: (note: NoteRecord) => void
  onDeleteNote: (id: string) => void
  onViewPublish: (record: PublishRecord) => void
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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '...'
}

export function HistoryPanel({ 
  notes, 
  publishHistory, 
  onPublishNote, 
  onDeleteNote,
  onViewPublish 
}: HistoryPanelProps) {
  const [notesOpen, setNotesOpen] = useState(true)
  const [publishOpen, setPublishOpen] = useState(true)

  const hasContent = notes.length > 0 || publishHistory.length > 0

  if (!hasContent) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Notes Section */}
      {notes.length > 0 && (
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-note/5 border border-note/20 hover:bg-note/10 transition-colors">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-note" />
                <span className="font-medium text-sm">Notes</span>
                <Badge variant="outline" className="text-xs border-note/30 text-note/80 bg-note/10">
                  {notes.length}
                </Badge>
              </div>
              {notesOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-64 mt-2">
              <div className="space-y-2">
                {notes.map((note) => (
                  <Card 
                    key={note.id} 
                    className="border-note/20 bg-note/5 hover:bg-note/10 transition-colors"
                  >
                    <CardContent className="px-4 py-3">
                      <p className="text-sm text-foreground/85 leading-relaxed">
                        {truncate(note.text, 120)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(note.timestamp)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs text-research hover:text-research hover:bg-research/10"
                            onClick={() => onPublishNote(note)}
                          >
                            <Send className="w-3 h-3" />
                            Publish
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDeleteNote(note.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Publish History Section */}
      {publishHistory.length > 0 && (
        <Collapsible open={publishOpen} onOpenChange={setPublishOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-research/5 border border-research/20 hover:bg-research/10 transition-colors">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-research" />
                <span className="font-medium text-sm">Published</span>
                <Badge variant="outline" className="text-xs border-research/30 text-research/80 bg-research/10">
                  {publishHistory.length}
                </Badge>
              </div>
              {publishOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-64 mt-2">
              <div className="space-y-2">
                {publishHistory.map((record) => (
                  <Card 
                    key={record.id} 
                    className={cn(
                      "border-research/20 bg-research/5 hover:bg-research/10 transition-colors cursor-pointer",
                      record.sourceNoteId && "border-l-2 border-l-note"
                    )}
                    onClick={() => onViewPublish(record)}
                  >
                    <CardContent className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground/90 leading-relaxed">
                            {truncate(record.transcript, 80)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {truncate(record.summary, 60)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {record.research && (
                            <Badge variant="outline" className="text-xs border-research/40 text-research bg-research/10">
                              Deep Research
                            </Badge>
                          )}
                          {record.sourceNoteId && (
                            <Badge variant="outline" className="text-xs border-note/40 text-note bg-note/10">
                              From Note
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(record.timestamp)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
