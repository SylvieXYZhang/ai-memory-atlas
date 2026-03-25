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
