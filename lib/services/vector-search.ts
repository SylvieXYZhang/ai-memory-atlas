// Vector Search Service using TF-IDF for semantic similarity
// Client-side implementation for note retrieval

import type { NoteRecord, SearchResult } from '../types'

/**
 * Simple TF-IDF implementation for client-side semantic search
 */
class TfIdf {
  private documents: string[] = []
  private termFrequencies: Map<string, number>[] = []
  private documentFrequencies: Map<string, number> = new Map()

  /**
   * Tokenize and normalize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }

  /**
   * Calculate term frequency for a document
   */
  private calculateTf(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>()
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1)
    })
    // Normalize by document length
    tokens.length > 0 && tf.forEach((count, term) => {
      tf.set(term, count / tokens.length)
    })
    return tf
  }

  /**
   * Add a document to the corpus
   */
  addDocument(text: string): void {
    const tokens = this.tokenize(text)
    const tf = this.calculateTf(tokens)
    
    this.documents.push(text)
    this.termFrequencies.push(tf)
    
    // Update document frequencies
    const uniqueTokens = new Set(tokens)
    uniqueTokens.forEach(token => {
      this.documentFrequencies.set(
        token, 
        (this.documentFrequencies.get(token) || 0) + 1
      )
    })
  }

  /**
   * Calculate TF-IDF vector for a text
   */
  private getTfIdfVector(text: string): Map<string, number> {
    const tokens = this.tokenize(text)
    const tf = this.calculateTf(tokens)
    const tfidf = new Map<string, number>()
    const numDocs = this.documents.length || 1

    tf.forEach((tfValue, term) => {
      const df = this.documentFrequencies.get(term) || 0
      const idf = df > 0 ? Math.log(numDocs / df) : 0
      tfidf.set(term, tfValue * idf)
    })

    return tfidf
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    vec1.forEach((value, key) => {
      norm1 += value * value
      if (vec2.has(key)) {
        dotProduct += value * (vec2.get(key) || 0)
      }
    })

    vec2.forEach(value => {
      norm2 += value * value
    })

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude > 0 ? dotProduct / magnitude : 0
  }

  /**
   * Find similar documents to a query
   */
  findSimilar(query: string, topK: number = 5): Array<{ index: number; similarity: number }> {
    const queryVector = this.getTfIdfVector(query)
    const similarities: Array<{ index: number; similarity: number }> = []

    this.termFrequencies.forEach((docTf, index) => {
      // Convert TF to TF-IDF
      const docVector = new Map<string, number>()
      const numDocs = this.documents.length || 1
      
      docTf.forEach((tfValue, term) => {
        const df = this.documentFrequencies.get(term) || 0
        const idf = df > 0 ? Math.log(numDocs / df) : 0
        docVector.set(term, tfValue * idf)
      })

      const similarity = this.cosineSimilarity(queryVector, docVector)
      similarities.push({ index, similarity })
    })

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents = []
    this.termFrequencies = []
    this.documentFrequencies = new Map()
  }
}

// Singleton instance
let tfidfInstance: TfIdf | null = null

/**
 * Get or create TF-IDF instance
 */
function getTfIdf(): TfIdf {
  if (!tfidfInstance) {
    tfidfInstance = new TfIdf()
  }
  return tfidfInstance
}

/**
 * Build index from notes
 */
export function buildIndex(notes: NoteRecord[]): void {
  const tfidf = getTfIdf()
  tfidf.clear()
  notes.forEach(note => {
    tfidf.addDocument(note.text)
  })
}

/**
 * Search for similar notes
 */
export function searchSimilarNotes(
  query: string, 
  notes: NoteRecord[], 
  excludeId?: string,
  topK: number = 5,
  minSimilarity: number = 0.05
): SearchResult[] {
  if (notes.length === 0) return []

  // Rebuild index to ensure it's current
  buildIndex(notes)

  const tfidf = getTfIdf()
  const results = tfidf.findSimilar(query, topK + 1) // Get one extra in case we need to exclude

  return results
    .filter(r => {
      const note = notes[r.index]
      // Exclude the query note itself and filter by minimum similarity
      return note && note.id !== excludeId && r.similarity >= minSimilarity
    })
    .slice(0, topK)
    .map(r => ({
      note: notes[r.index],
      // Normalize similarity to a more intuitive 0-100 range
      similarity: Math.min(r.similarity * 10, 1) * 100
    }))
}

/**
 * Add a single note to the index
 */
export function addToIndex(note: NoteRecord): void {
  const tfidf = getTfIdf()
  tfidf.addDocument(note.text)
}
