'use client'

import { useRef, useEffect } from 'react'
import { Terminal, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { LogEntry } from '@/lib/types'
import { useState } from 'react'

interface DebugPanelProps {
  logs: LogEntry[]
  onClear: () => void
}

export function DebugPanel({ logs, onClear }: DebugPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isCollapsed])

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-research'
      case 'error':
        return 'text-destructive'
      case 'warning':
        return 'text-note'
      default:
        return 'text-muted-foreground'
    }
  }

  const getLogPrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return '[OK]'
      case 'error':
        return '[ERR]'
      case 'warning':
        return '[WARN]'
      default:
        return '[INFO]'
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Debug Console</span>
          <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={onClear}
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Log content */}
      {!isCollapsed && (
        <ScrollArea className="h-40">
          <div ref={scrollRef} className="p-3 font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground italic">No logs yet. Start recording to see activity.</p>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index}
                  className={cn("flex gap-2", getLogColor(log.type))}
                >
                  <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                  <span className="shrink-0 font-semibold">{getLogPrefix(log.type)}</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
