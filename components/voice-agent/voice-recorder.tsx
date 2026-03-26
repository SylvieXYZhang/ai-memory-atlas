'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

interface VoiceRecorderProps {
  isRecording: boolean
  recordingTime: number
  isProcessing: boolean
  onStartRecording: () => void
  onStopRecording: (audioBlob: Blob) => void
  onError?: (error: string) => void
  maxDuration?: number
}

export function VoiceRecorder({
  isRecording,
  recordingTime,
  isProcessing,
  onStartRecording,
  onStopRecording,
  onError,
  maxDuration = 180 // Default to 3 minutes
}: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Check microphone permission on mount
  useEffect(() => {
    checkMicrophonePermission()
  }, [])

  const checkMicrophonePermission = async () => {
    try {
      // Check if permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setPermissionState(result.state as PermissionState)
        
        // Listen for permission changes
        result.onchange = () => {
          setPermissionState(result.state as PermissionState)
        }
      } else {
        // Permissions API not available, try to get stream to check
        setPermissionState('prompt')
      }
    } catch {
      // Some browsers don't support microphone permission query
      setPermissionState('prompt')
    }
  }

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
    setErrorMessage(null)
    
    // Check if browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = 'Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Edge.'
      setErrorMessage(error)
      onError?.(error)
      return
    }

    try {
      audioChunksRef.current = []
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      
      setPermissionState('granted')
      streamRef.current = stream
      
      // Determine supported mime type
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        onStopRecording(audioBlob)
      }

      mediaRecorder.onerror = (event) => {
        const error = `Recording error: ${(event as ErrorEvent).message || 'Unknown error'}`
        setErrorMessage(error)
        onError?.(error)
        stopRecording()
      }

      // Start recording with timeslice to get data periodically
      mediaRecorder.start(1000)
      onStartRecording()
    } catch (error) {
      let errorMsg = 'Could not access microphone.'
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings and reload the page.'
            setPermissionState('denied')
            break
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            errorMsg = 'No microphone found. Please connect a microphone and try again.'
            break
          case 'NotReadableError':
          case 'TrackStartError':
            errorMsg = 'Microphone is in use by another application. Please close other apps using the microphone.'
            break
          case 'OverconstrainedError':
            errorMsg = 'Microphone does not meet requirements. Please try a different microphone.'
            break
          case 'SecurityError':
            errorMsg = 'Microphone access blocked due to security settings. Please use HTTPS.'
            break
          default:
            errorMsg = `Microphone error: ${error.message}`
        }
      }
      
      setErrorMessage(errorMsg)
      onError?.(errorMsg)
    }
  }, [onStartRecording, onStopRecording, onError, stopRecording])

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
      <div className="text-center max-w-sm">
        {errorMessage ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <p className="font-medium">Error</p>
            </div>
            <p className="text-sm text-destructive/80">{errorMessage}</p>
            {permissionState === 'denied' && (
              <p className="text-xs text-muted-foreground mt-1">
                To fix: Click the lock/camera icon in your browser&apos;s address bar and allow microphone access.
              </p>
            )}
          </div>
        ) : isProcessing ? (
          <p className="text-muted-foreground">Processing audio...</p>
        ) : isRecording ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-destructive font-medium">Recording...</p>
            <p className="text-sm text-muted-foreground">
              {formatTime(recordingTime)} / {formatTime(maxDuration)}
            </p>
          </div>
        ) : permissionState === 'denied' ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-destructive font-medium">Microphone access denied</p>
            <p className="text-xs text-muted-foreground">
              Please allow microphone access in your browser settings
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-muted-foreground">Click to start recording</p>
            <p className="text-xs text-muted-foreground">Up to {formatTime(maxDuration)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
