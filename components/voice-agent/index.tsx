'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Settings, Volume2, FileText, Lightbulb, FlaskConical } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { VoiceRecorder } from './voice-recorder'
import { DebugPanel } from './debug-panel'
import { ResultTabs } from './result-tabs'
import { NoteDisplay } from './note-display'
import { MagicButton } from './magic-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

// Services
import { transcribeAudio, mockTranscribeAudio } from '@/lib/services/asr'
import { detectIntent, generateSummary, performDeepResearch } from '@/lib/services/llm'
import { searchSimilarNotes } from '@/lib/services/vector-search'
import { getNotes, saveNote, seedDemoNotes } from '@/lib/services/storage'
import type { TemplateData } from '@/lib/types'

const API_KEY_STORAGE_KEY = 'voiceagent_api_key'

export function VoiceAgent() {
  const store = useAppStore()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const apiKeyRef = useRef<string>('')

  // Load API key and notes on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      apiKeyRef.current = localStorage.getItem(API_KEY_STORAGE_KEY) || ''
      store.setNotes(getNotes())
    }
  }, [])

  // Recording timer
  useEffect(() => {
    if (store.isRecording) {
      timerRef.current = setInterval(() => {
        store.setRecordingTime(store.recordingTime + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [store.isRecording, store.recordingTime])

  const handleStartRecording = useCallback(() => {
    store.reset()
    store.setIsRecording(true)
    store.setLoadingState('recording')
    store.addLog('Recording started', 'info')
  }, [])

  const handleStopRecording = useCallback(async (audioBlob: Blob) => {
    store.setIsRecording(false)
    store.setLoadingState('transcribing')
    store.addLog(`Recording stopped (${store.recordingTime}s)`, 'info')
    store.addLog('Starting transcription...', 'info')

    try {
      // Transcribe audio
      let transcript: string
      if (apiKeyRef.current) {
        transcript = await transcribeAudio(audioBlob, apiKeyRef.current)
      } else {
        store.addLog('No API key - using demo mode', 'warning')
        transcript = await mockTranscribeAudio(store.recordingTime * 1000)
      }
      
      store.setTranscript(transcript)
      store.addLog(`Transcription complete: "${transcript.slice(0, 50)}..."`, 'success')

      // Detect intent
      store.setLoadingState('analyzing')
      store.addLog('Analyzing intent...', 'info')
      
      const intent = await detectIntent(transcript, apiKeyRef.current)
      store.setIntent(intent)
      store.addLog(`Intent detected: ${intent}`, 'success')

      if (intent === 'note') {
        // Note flow — save the verbatim transcript, no summarisation
        store.setLoadingState('saving-note')
        store.addLog('Saving verbatim note...', 'info')
        
        const note = saveNote(transcript)     // exact words, no processing
        const notes = getNotes()
        store.setNotes(notes)
        store.setCurrentNote(note)
        
        // Find semantically related notes from the knowledge base
        const related = searchSimilarNotes(transcript, notes, note.id)
        store.setRelatedNotes(related)
        
        store.addLog(
          `Note saved (${transcript.split(/\s+/).length} words). ${related.length} semantic connection${related.length !== 1 ? 's' : ''} found.`,
          'success'
        )
        store.setLoadingState('complete')
      } else {
        // Publish flow
        store.setLoadingState('generating-summary')
        store.addLog('Generating quick summary...', 'info')
        
        const summary = await generateSummary(transcript, apiKeyRef.current)
        store.setSummary(summary)
        store.addLog('Summary generated', 'success')
        store.setLoadingState('complete')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.addLog(`Error: ${message}`, 'error')
      store.setLoadingState('error')
    }
  }, [store.recordingTime])

  const handleDeepResearch = useCallback(async () => {
    if (!store.transcript) return

    store.setLoadingState('deep-research')
    store.addLog('Starting deep research with web search...', 'info')
    store.addLog('This may take 30-60 seconds...', 'warning')

    try {
      const research = await performDeepResearch(store.transcript, apiKeyRef.current)
      store.setResearchData(research)
      store.addLog('Deep research complete!', 'success')
      store.setLoadingState('complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.addLog(`Research error: ${message}`, 'error')
      store.setLoadingState('error')
    }
  }, [store.transcript])

  const handleSaveApiKey = (key: string) => {
    apiKeyRef.current = key
    if (typeof window !== 'undefined') {
      localStorage.setItem(API_KEY_STORAGE_KEY, key)
    }
    store.addLog('API key saved', 'success')
  }

  const handleLoadDemoNotes = useCallback(() => {
    const notes = seedDemoNotes()
    store.setNotes(notes)
    store.addLog(`Loaded ${notes.length} demo notes with semantic overlap`, 'success')
    store.addLog('Try saying something about AI, startups, or note-taking to see connections!', 'info')
  }, [])

  const isProcessing = ['transcribing', 'analyzing', 'generating-summary', 'saving-note'].includes(store.loadingState)
  const isDeepResearching = store.loadingState === 'deep-research'
  const showPublishResult = store.intent === 'publish' && store.summary && store.loadingState === 'complete'
  const showNoteResult = store.intent === 'note' && store.currentNote && store.loadingState === 'complete'

  const templateData: TemplateData = {
    topic: store.transcript,
    summary: store.summary,
    research: store.researchData || undefined
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">VoiceAgent</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Research Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadDemoNotes}
              className="gap-2"
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Load Demo Notes</span>
            </Button>

            <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>API Key (Alibaba DashScope)</FieldLabel>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    defaultValue={apiKeyRef.current}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for demo mode with mock responses
                  </p>
                </Field>
              </FieldGroup>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-balance">
              Your Voice, Your Research
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-pretty">
              Speak freely. In Publish Mode the AI researches and drafts content. 
              In Note Mode your exact words are saved and automatically linked to semantically related ideas.
            </p>
          </div>

          {/* Mode indicators */}
          <div className="flex items-center justify-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors",
              store.intent === 'publish' 
                ? "border-research bg-research/10 text-research" 
                : "border-border text-muted-foreground"
            )}>
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Publish Mode</span>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-colors",
              store.intent === 'note' 
                ? "border-note bg-note/10 text-note" 
                : "border-border text-muted-foreground"
            )}>
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">Note Mode</span>
            </div>
          </div>

          {/* Voice recorder */}
          <div className="flex justify-center py-8">
            <VoiceRecorder
              isRecording={store.isRecording}
              recordingTime={store.recordingTime}
              isProcessing={isProcessing}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          </div>

          {/* Transcript display */}
          {store.transcript && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Transcript:</p>
              <p className="text-foreground">{store.transcript}</p>
            </div>
          )}

          {/* Publish results */}
          {showPublishResult && (
            <div className="space-y-6">
              {/* Quick summary */}
              {!store.researchData && (
                <div className="p-6 rounded-lg bg-research/5 border border-research/30">
                  <h3 className="text-lg font-semibold text-research mb-3">Quick Summary</h3>
                  <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{store.summary}</p>
                </div>
              )}

              {/* Magic button for deep research */}
              {!store.researchData && (
                <div className="flex justify-center">
                  <MagicButton
                    onClick={handleDeepResearch}
                    isLoading={isDeepResearching}
                  />
                </div>
              )}

              {/* Deep research results */}
              {store.researchData && (
                <ResultTabs
                  data={templateData}
                  activeTab={store.activeTab}
                  onTabChange={store.setActiveTab}
                />
              )}
            </div>
          )}

          {/* Note results */}
          {showNoteResult && (
            <NoteDisplay
              currentNote={store.currentNote}
              relatedNotes={store.relatedNotes}
            />
          )}

          {/* Deep research loading state */}
          {isDeepResearching && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-research/10 border border-research/30">
                <div className="w-2 h-2 rounded-full bg-research animate-pulse" />
                <span className="text-research font-medium">Conducting deep research with web search...</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                This may take 30-60 seconds. Please wait...
              </p>
            </div>
          )}

          {/* Debug panel */}
          <DebugPanel
            logs={store.logs}
            onClear={store.clearLogs}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          VoiceAgent MVP - Voice-powered AI Research Assistant
        </div>
      </footer>
    </div>
  )
}
