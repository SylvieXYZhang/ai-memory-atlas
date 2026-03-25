// Utility functions for VoiceAgent

/**
 * Convert a Blob to Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Extract the topic from user input by removing common prefixes
 */
export function extractTopic(text: string): string {
  const prefixes = [
    // Research prefixes
    /^(please\s+)?(help\s+me\s+)?(research|analyze|study|investigate|look\s+into|find\s+out\s+about)\s*/i,
    /^(i\s+want\s+to\s+)(know|learn|understand)\s+(about|more\s+about)\s*/i,
    /^(what\s+is|what\s+are|tell\s+me\s+about)\s*/i,
    /^(can\s+you\s+)(research|analyze|explain)\s*/i,
    
    // Note prefixes
    /^(please\s+)?(help\s+me\s+)?(record|note|save|remember|write\s+down)\s*/i,
    /^(i\s+just\s+)(thought|realized|remembered|had\s+an\s+idea)\s*/i,
    /^(note\s+to\s+self|reminder)\s*:?\s*/i,
  ]
  
  let result = text.trim()
  for (const prefix of prefixes) {
    result = result.replace(prefix, '')
  }
  
  // Clean up extra whitespace and punctuation
  result = result.replace(/^[:\-,.\s]+/, '').trim()
  
  return result || text
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
