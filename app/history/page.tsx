'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, StickyNote, FileText, Zap, Clock, Send, Calendar, Bell, CheckSquare, Timer, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { NoteRecord, PublishRecord, ActionHistoryItem } from '@/lib/types'
import { getNotes } from '@/lib/services/storage'

const PUBLISH_HISTORY_KEY = 'voiceagent_publish_history'
const ACTION_HISTORY_KEY = 'voice_agent_action_history'

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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '...'
}

const actionCategoryIcons = {
  calendar: Calendar,
  reminder: Bell,
  task: CheckSquare,
  timer: Timer,
  unknown: Zap
}

const actionCategoryColors = {
  calendar: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  reminder: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  task: 'text-green-500 bg-green-500/10 border-green-500/30',
  timer: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  unknown: 'text-muted-foreground bg-muted/50 border-border'
}

const statusColors = {
  pending: 'text-amber-500 bg-amber-500/10',
  confirmed: 'text-blue-500 bg-blue-500/10',
  executed: 'text-green-500 bg-green-500/10',
  cancelled: 'text-muted-foreground bg-muted/50',
  failed: 'text-destructive bg-destructive/10'
}

export default function HistoryPage() {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [publishHistory, setPublishHistory] = useState<PublishRecord[]>([])
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([])
  const [activeTab, setActiveTab] = useState<'notes' | 'publish' | 'actions'>('notes')

  useEffect(() => {
    // Load notes
    setNotes(getNotes())
    
    // Load publish history
    const savedPublish = localStorage.getItem(PUBLISH_HISTORY_KEY)
    if (savedPublish) {
      try {
        setPublishHistory(JSON.parse(savedPublish))
      } catch {
        // Ignore parse errors
      }
    }
    
    // Load action history
    const savedActions = localStorage.getItem(ACTION_HISTORY_KEY)
    if (savedActions) {
      try {
        setActionHistory(JSON.parse(savedActions))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  const clearNotes = () => {
    localStorage.removeItem('voiceagent_notes')
    setNotes([])
  }

  const clearPublishHistory = () => {
    localStorage.removeItem(PUBLISH_HISTORY_KEY)
    setPublishHistory([])
  }

  const clearActionHistory = () => {
    localStorage.removeItem(ACTION_HISTORY_KEY)
    setActionHistory([])
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">History</h1>
              <p className="text-sm text-muted-foreground">View all your notes, publications, and actions</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
            <TabsTrigger value="notes" className="gap-2 data-[state=active]:bg-note/10 data-[state=active]:text-note">
              <StickyNote className="w-4 h-4" />
              Notes
              {notes.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{notes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-2 data-[state=active]:bg-research/10 data-[state=active]:text-research">
              <FileText className="w-4 h-4" />
              Published
              {publishHistory.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{publishHistory.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2 data-[state=active]:bg-action/10 data-[state=active]:text-action">
              <Zap className="w-4 h-4" />
              Actions
              {actionHistory.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{actionHistory.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-note" />
                    Saved Notes
                  </CardTitle>
                  <CardDescription>Your voice notes saved for later</CardDescription>
                </div>
                {notes.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearNotes}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No notes yet</p>
                    <p className="text-sm">Switch to Note mode and start recording</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <Card key={note.id} className="border-note/20 bg-note/5 hover:bg-note/10 transition-colors">
                          <CardContent className="px-4 py-3">
                            <p className="text-sm text-foreground/90 leading-relaxed">{note.text}</p>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-note/10">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(note.timestamp)}
                              </span>
                              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-research hover:text-research hover:bg-research/10">
                                <Send className="w-3 h-3" />
                                Publish
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-research" />
                    Published Content
                  </CardTitle>
                  <CardDescription>AI-researched and generated content</CardDescription>
                </div>
                {publishHistory.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearPublishHistory}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {publishHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No publications yet</p>
                    <p className="text-sm">Switch to Publish mode and start recording</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {publishHistory.map((record) => (
                        <Card key={record.id} className={cn(
                          "border-research/20 bg-research/5 transition-colors",
                          record.sourceNoteId && "border-l-2 border-l-note"
                        )}>
                          <CardContent className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-foreground/90">{truncate(record.transcript, 100)}</p>
                              <div className="flex gap-1 flex-shrink-0">
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
                            <p className="text-sm text-muted-foreground">{truncate(record.summary, 150)}</p>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-3 pt-2 border-t border-research/10">
                              <Clock className="w-3 h-3" />
                              {formatDate(record.timestamp)}
                            </span>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-action" />
                    Action History
                  </CardTitle>
                  <CardDescription>Calendar events, reminders, tasks, and timers</CardDescription>
                </div>
                {actionHistory.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearActionHistory}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {actionHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No actions yet</p>
                    <p className="text-sm">Switch to Action mode and start recording</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {actionHistory.map((item) => {
                        const Icon = actionCategoryIcons[item.action.category] || Zap
                        const colorClass = actionCategoryColors[item.action.category] || actionCategoryColors.unknown
                        const statusClass = statusColors[item.action.status] || statusColors.pending
                        
                        return (
                          <Card key={item.action.id} className={cn("border transition-colors", colorClass.split(' ')[2])}>
                            <CardContent className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className={cn("p-2 rounded-lg", colorClass)}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium">{item.action.title}</p>
                                    <Badge variant="outline" className={cn("text-xs", statusClass)}>
                                      {item.action.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{item.action.description}</p>
                                  {item.action.executionResult && (
                                    <p className="text-xs text-green-600 mt-1">{item.action.executionResult}</p>
                                  )}
                                  {item.action.executionError && (
                                    <p className="text-xs text-destructive mt-1">{item.action.executionError}</p>
                                  )}
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(item.action.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
