'use client'

import { useState } from 'react'
import { Copy, Check, Download, Share2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TemplateType, TemplateData } from '@/lib/types'
import { renderTemplate, getTemplateDisplayName } from '@/lib/services/templates'

interface ResultTabsProps {
  data: TemplateData
  activeTab: TemplateType
  onTabChange: (tab: TemplateType) => void
}

export function ResultTabs({ data, activeTab, onTabChange }: ResultTabsProps) {
  const [copied, setCopied] = useState(false)

  const tabs: TemplateType[] = ['social', 'blog', 'report']

  const handleCopy = async () => {
    const content = renderTemplate(data, activeTab)
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[v0] Failed to copy:', error)
    }
  }

  const handleDownload = () => {
    const content = renderTemplate(data, activeTab)
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.topic.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}-${activeTab}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const content = renderTemplate(data, activeTab)
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.topic,
          text: content
        })
      } catch (error) {
        // User cancelled or share failed
        console.error('[v0] Share failed:', error)
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as TemplateType)}>
        {/* Tab header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                  "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                )}
              >
                {getTemplateDisplayName(tab)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 gap-1.5"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-research" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 gap-1.5"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              <span className="text-xs">Download</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 gap-1.5"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs">Share</span>
            </Button>
          </div>
        </div>

        {/* Tab content */}
        {tabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="m-0">
            <ScrollArea className="h-[400px]">
              <div className="p-6 prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={renderTemplate(data, tab)} />
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// Simple markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  
  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold text-foreground mt-6 mb-4">{line.slice(2)}</h1>
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold text-foreground mt-5 mb-3">{line.slice(3)}</h2>
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium text-foreground mt-4 mb-2">{line.slice(4)}</h3>
        }
        
        // Horizontal rule
        if (line === '---') {
          return <hr key={index} className="border-border my-4" />
        }
        
        // List items
        if (line.startsWith('- ')) {
          return (
            <li key={index} className="ml-4 text-foreground/90">
              <InlineMarkdown text={line.slice(2)} />
            </li>
          )
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.*)$/)
          if (match) {
            return (
              <li key={index} className="ml-4 text-foreground/90 list-decimal">
                <InlineMarkdown text={match[2]} />
              </li>
            )
          }
        }
        
        // Table rows
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim())
          if (cells.every(c => c.trim().match(/^-+$/))) {
            return null // Skip separator row
          }
          return (
            <div key={index} className="grid grid-cols-2 gap-2 py-1 border-b border-border/50">
              {cells.map((cell, i) => (
                <span key={i} className="text-sm text-foreground/80">{cell.trim()}</span>
              ))}
            </div>
          )
        }
        
        // Italic text (full line)
        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
          return <p key={index} className="text-muted-foreground italic text-sm">{line.slice(1, -1)}</p>
        }
        
        // Empty line
        if (line.trim() === '') {
          return <div key={index} className="h-2" />
        }
        
        // Regular paragraph
        return (
          <p key={index} className="text-foreground/90 leading-relaxed">
            <InlineMarkdown text={line} />
          </p>
        )
      })}
    </div>
  )
}

// Inline markdown parser for bold and italic
function InlineMarkdown({ text }: { text: string }) {
  // Parse bold (**text**) and inline code (`code`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={index} className="bg-secondary px-1 py-0.5 rounded text-xs">{part.slice(1, -1)}</code>
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}
