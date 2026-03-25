'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  isRecording: boolean
  recordingTime: number
  isProcessing: boolean
  onStartRecording: () => void
  onStopRecording: (audioBlob: Blob) => void
  maxDuration?: number
}

export function VoiceRecorder({
  isRecording,
  recordingTime,
  isProcessing,
  onStartRecording,
  onStopRecording,
  maxDuration = 5
}: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      audioChunksRef.current = []
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        })
        onStopRecording(audioBlob)
      }

      mediaRecorder.start()
      onStartRecording()
    } catch (error) {
      console.error('[v0] Error starting recording:', error)
      alert('Could not access microphone. Please ensure you have granted permission.')
    }
  }, [onStartRecording, onStopRecording])

  // Auto-stop after max duration
  useEffect(() => {
    if (isRecording && recordingTime >= maxDuration) {
      stopRecording()
    }
  }, [isRecording, recordingTime, maxDuration, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  const handleClick = () => {
    if (isProcessing) return
    
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const progress = (recordingTime / maxDuration) * 100

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main recording button */}
      <div className="relative">
        {/* Progress ring */}
        {isRecording && (
          <svg 
            className="absolute inset-0 -rotate-90" 
            width="96" 
            height="96"
            viewBox="0 0 96 96"
          >
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-muted/30"
            />
            <circle
              cx="48"
              cy="48"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)}
              className="text-destructive transition-all duration-100"
              strokeLinecap="round"
            />
          </svg>
        )}
        
        <Button
          size="lg"
          onClick={handleClick}
          disabled={isProcessing}
          className={cn(
            "w-24 h-24 rounded-full transition-all duration-300",
            isRecording && "bg-destructive hover:bg-destructive/90 recording-indicator",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </Button>
      </div>

      {/* Status text */}
      <div className="text-center">
        {isProcessing ? (
          <p className="text-muted-foreground">Processing audio...</p>
        ) : isRecording ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-destructive font-medium">Recording...</p>
            <p className="text-sm text-muted-foreground">
              {recordingTime}s / {maxDuration}s
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">Click to start recording</p>
        )}
      </div>
    </div>
  )
}
