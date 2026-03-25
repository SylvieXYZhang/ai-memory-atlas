// LocalStorage-based persistence for notes
// MVP implementation - all data stored client-side

import type { NoteRecord } from '../types'
import { generateId, formatTimestamp } from '../voice-utils'

const STORAGE_KEY = 'voiceagent_notes'

/**
 * Get all notes from storage
 */
export function getNotes(): NoteRecord[] {
  if (typeof window === 'undefined') return []
  
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    
    const notes = JSON.parse(data) as NoteRecord[]
    return notes.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('[v0] Error reading notes from storage:', error)
    return []
  }
}

/**
 * Save a new note
 */
export function saveNote(text: string): NoteRecord {
  const timestamp = Date.now()
  const note: NoteRecord = {
    id: generateId(),
    text,
    timestamp,
    createdAt: formatTimestamp(timestamp)
  }
  
  const notes = getNotes()
  notes.unshift(note)
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch (error) {
    console.error('[v0] Error saving note to storage:', error)
  }
  
  return note
}

/**
 * Delete a note
 */
export function deleteNote(id: string): void {
  const notes = getNotes().filter(note => note.id !== id)
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch (error) {
    console.error('[v0] Error deleting note from storage:', error)
  }
}

/**
 * Clear all notes
 */
export function clearNotes(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[v0] Error clearing notes from storage:', error)
  }
}

/**
 * Get note count
 */
export function getNoteCount(): number {
  return getNotes().length
}

/**
 * Export notes as JSON
 */
export function exportNotes(): string {
  const notes = getNotes()
  return JSON.stringify(notes, null, 2)
}

/**
 * Import notes from JSON
 */
export function importNotes(json: string): number {
  try {
    const imported = JSON.parse(json) as NoteRecord[]
    if (!Array.isArray(imported)) {
      throw new Error('Invalid format')
    }
    
    const existing = getNotes()
    const existingIds = new Set(existing.map(n => n.id))
    
    // Add only new notes
    const newNotes = imported.filter(n => !existingIds.has(n.id))
    const merged = [...newNotes, ...existing].sort((a, b) => b.timestamp - a.timestamp)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return newNotes.length
  } catch (error) {
    console.error('[v0] Error importing notes:', error)
    throw new Error('Failed to import notes. Please check the file format.')
  }
}

/**
 * Seed demo notes with semantic overlap for testing connections
 * These notes share overlapping topics so the TF-IDF algorithm can find links
 */
export function seedDemoNotes(): NoteRecord[] {
  const demoNotes: Array<{ text: string; offsetMinutes: number }> = [
    // AI / machine learning cluster
    {
      text: "I think the future of artificial intelligence lies in multimodal models that can understand images, audio, and text together. The key challenge is alignment — making sure AI systems do what humans actually want.",
      offsetMinutes: 120
    },
    {
      text: "Just read about reinforcement learning from human feedback. It's fascinating how we can train AI models to be more helpful by having humans rank different outputs. This seems crucial for alignment.",
      offsetMinutes: 90
    },
    {
      text: "Neural networks are essentially function approximators. The magic happens when you stack enough layers and train on enough data. But we still don't fully understand why deep learning works so well.",
      offsetMinutes: 60
    },

    // Productivity / second brain cluster
    {
      text: "Building a second brain is about capturing ideas before they disappear. The key is to write things down immediately and trust the system to surface connections later.",
      offsetMinutes: 50
    },
    {
      text: "I want to build a voice-based note taking system that automatically links related ideas using semantic search. This could be a game changer for capturing fleeting thoughts.",
      offsetMinutes: 40
    },
    {
      text: "The Zettelkasten method is powerful because it forces you to write ideas in your own words and connect them to existing notes. Atomic notes are the key.",
      offsetMinutes: 30
    },

    // Business / startups cluster
    {
      text: "Product market fit is the only thing that matters in the early days of a startup. You can fix almost anything else, but if people don't want what you're building, nothing else matters.",
      offsetMinutes: 25
    },
    {
      text: "The best way to validate a startup idea is to talk to potential customers before writing any code. Build the smallest thing that tests your core assumption.",
      offsetMinutes: 20
    },

    // Cross-cluster (AI + business)
    {
      text: "AI startups need to find defensible moats. The model itself is rarely the moat — it's usually the data flywheel or the distribution. OpenAI has distribution, but what about smaller players?",
      offsetMinutes: 15
    },

    // Cross-cluster (productivity + AI)
    {
      text: "Using AI to automatically tag and link notes could revolutionize personal knowledge management. The challenge is doing this without requiring constant manual curation.",
      offsetMinutes: 10
    }
  ]

  // Clear existing notes first
  clearNotes()

  const now = Date.now()
  const notes: NoteRecord[] = demoNotes.map((demo, index) => {
    const timestamp = now - demo.offsetMinutes * 60 * 1000
    return {
      id: `demo_${index}_${timestamp}`,
      text: demo.text,
      timestamp,
      createdAt: formatTimestamp(timestamp)
    }
  })

  // Sort by timestamp descending (newest first)
  notes.sort((a, b) => b.timestamp - a.timestamp)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch (error) {
    console.error('[v0] Error seeding demo notes:', error)
  }

  return notes
}
