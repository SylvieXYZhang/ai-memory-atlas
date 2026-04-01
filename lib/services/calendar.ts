/**
 * Calendar Integration Service
 * Supports: Google Calendar, Microsoft Outlook, ICS Download (universal fallback)
 * 
 * RESEARCH LOG:
 * =============
 * Google Calendar API:
 * - Requires: GCP Project, OAuth 2.0 Client ID, Calendar API enabled
 * - Scopes: https://www.googleapis.com/auth/calendar.events
 * - Endpoints: POST/PUT/DELETE /calendars/{calendarId}/events/{eventId}
 * - Complexity: Medium (OAuth flow required)
 * 
 * Microsoft Outlook (Graph API):
 * - Requires: Azure AD App Registration, OAuth 2.0
 * - Scopes: Calendars.ReadWrite
 * - Endpoints: POST/PATCH/DELETE /me/events/{id}
 * - Complexity: Medium (OAuth flow required)
 * 
 * Apple iCloud (CalDAV):
 * - Requires: App-specific password, CalDAV protocol
 * - Issues: CORS blocks browser requests, needs server proxy
 * - Complexity: High (not feasible for client-side web app)
 * - DECISION: Use ICS download for Apple Calendar users
 */

// Storage keys
const GOOGLE_TOKEN_KEY = 'voiceagent_google_token'
const OUTLOOK_TOKEN_KEY = 'voiceagent_outlook_token'
const CALENDAR_CONFIG_KEY = 'voiceagent_calendar_config'

export type CalendarProvider = 'google' | 'outlook' | 'ics'

export interface CalendarEvent {
  id?: string
  title: string
  description?: string
  location?: string
  startDate: string // ISO datetime
  endDate: string   // ISO datetime
  allDay?: boolean
}

export interface CalendarConfig {
  provider: CalendarProvider
  googleClientId?: string
  outlookClientId?: string
}

export interface CalendarToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

// Google Calendar API
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// Microsoft Graph API
const OUTLOOK_SCOPES = 'Calendars.ReadWrite offline_access'
const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

/**
 * Load calendar configuration
 */
export function loadCalendarConfig(): CalendarConfig | null {
  try {
    const saved = localStorage.getItem(CALENDAR_CONFIG_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

/**
 * Save calendar configuration
 */
export function saveCalendarConfig(config: CalendarConfig): void {
  localStorage.setItem(CALENDAR_CONFIG_KEY, JSON.stringify(config))
}

/**
 * Check if a provider is connected
 */
export function isProviderConnected(provider: CalendarProvider): boolean {
  if (provider === 'ics') return true // Always available
  
  const tokenKey = provider === 'google' ? GOOGLE_TOKEN_KEY : OUTLOOK_TOKEN_KEY
  try {
    const saved = localStorage.getItem(tokenKey)
    if (!saved) return false
    const token: CalendarToken = JSON.parse(saved)
    return token.expiresAt > Date.now()
  } catch {
    return false
  }
}

/**
 * Get stored token for a provider
 */
function getToken(provider: 'google' | 'outlook'): CalendarToken | null {
  const tokenKey = provider === 'google' ? GOOGLE_TOKEN_KEY : OUTLOOK_TOKEN_KEY
  try {
    const saved = localStorage.getItem(tokenKey)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

/**
 * Save token for a provider
 */
function saveToken(provider: 'google' | 'outlook', token: CalendarToken): void {
  const tokenKey = provider === 'google' ? GOOGLE_TOKEN_KEY : OUTLOOK_TOKEN_KEY
  localStorage.setItem(tokenKey, JSON.stringify(token))
}

/**
 * Clear token for a provider
 */
export function disconnectProvider(provider: 'google' | 'outlook'): void {
  const tokenKey = provider === 'google' ? GOOGLE_TOKEN_KEY : OUTLOOK_TOKEN_KEY
  localStorage.removeItem(tokenKey)
}

// ============================================
// GOOGLE CALENDAR
// ============================================

/**
 * Initiate Google OAuth flow
 */
export function initiateGoogleAuth(clientId: string, redirectUri: string): void {
  const state = Math.random().toString(36).substring(2, 15)
  sessionStorage.setItem('google_oauth_state', state)
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: 'true',
    prompt: 'consent'
  })
  
  window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Handle Google OAuth callback (from URL hash)
 */
export function handleGoogleCallback(): CalendarToken | null {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  
  const accessToken = params.get('access_token')
  const expiresIn = params.get('expires_in')
  const state = params.get('state')
  
  // Verify state
  const savedState = sessionStorage.getItem('google_oauth_state')
  if (state !== savedState) {
    console.error('[v0] Google OAuth state mismatch')
    return null
  }
  sessionStorage.removeItem('google_oauth_state')
  
  if (!accessToken || !expiresIn) {
    console.error('[v0] Google OAuth missing token')
    return null
  }
  
  const token: CalendarToken = {
    accessToken,
    expiresAt: Date.now() + parseInt(expiresIn) * 1000
  }
  
  saveToken('google', token)
  
  // Clear hash from URL
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  
  return token
}

/**
 * Add event to Google Calendar
 */
export async function addGoogleEvent(event: CalendarEvent): Promise<{ success: boolean; message: string; eventId?: string }> {
  const token = getToken('google')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Google Calendar not connected. Please connect in Settings.' }
  }
  
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: event.allDay 
          ? { date: event.startDate.split('T')[0] }
          : { dateTime: event.startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: event.allDay
          ? { date: event.endDate.split('T')[0] }
          : { dateTime: event.endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return { success: true, message: `Event added to Google Calendar: "${event.title}"`, eventId: data.id }
  } catch (error) {
    return { success: false, message: `Google Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Update event in Google Calendar
 */
export async function updateGoogleEvent(eventId: string, event: CalendarEvent): Promise<{ success: boolean; message: string }> {
  const token = getToken('google')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Google Calendar not connected.' }
  }
  
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: event.allDay 
          ? { date: event.startDate.split('T')[0] }
          : { dateTime: event.startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: event.allDay
          ? { date: event.endDate.split('T')[0] }
          : { dateTime: event.endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    return { success: true, message: `Event updated in Google Calendar: "${event.title}"` }
  } catch (error) {
    return { success: false, message: `Google Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteGoogleEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  const token = getToken('google')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Google Calendar not connected.' }
  }
  
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`
      }
    })
    
    if (!response.ok && response.status !== 204) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    return { success: true, message: 'Event deleted from Google Calendar' }
  } catch (error) {
    return { success: false, message: `Google Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * List upcoming events from Google Calendar
 */
export async function listGoogleEvents(maxResults: number = 10): Promise<{ success: boolean; events?: CalendarEvent[]; message?: string }> {
  const token = getToken('google')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Google Calendar not connected.' }
  }
  
  try {
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      timeMin: new Date().toISOString(),
      orderBy: 'startTime',
      singleEvents: 'true'
    })
    
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const events: CalendarEvent[] = data.items?.map((item: { id: string; summary: string; description?: string; location?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }) => ({
      id: item.id,
      title: item.summary,
      description: item.description,
      location: item.location,
      startDate: item.start?.dateTime || item.start?.date || '',
      endDate: item.end?.dateTime || item.end?.date || '',
      allDay: !item.start?.dateTime
    })) || []
    
    return { success: true, events }
  } catch (error) {
    return { success: false, message: `Google Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// ============================================
// MICROSOFT OUTLOOK
// ============================================

/**
 * Initiate Outlook OAuth flow
 */
export function initiateOutlookAuth(clientId: string, redirectUri: string): void {
  const state = Math.random().toString(36).substring(2, 15)
  sessionStorage.setItem('outlook_oauth_state', state)
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES,
    state,
    response_mode: 'fragment'
  })
  
  window.location.href = `${OUTLOOK_AUTH_URL}?${params.toString()}`
}

/**
 * Handle Outlook OAuth callback
 */
export function handleOutlookCallback(): CalendarToken | null {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  
  const accessToken = params.get('access_token')
  const expiresIn = params.get('expires_in')
  const state = params.get('state')
  
  const savedState = sessionStorage.getItem('outlook_oauth_state')
  if (state !== savedState) {
    console.error('[v0] Outlook OAuth state mismatch')
    return null
  }
  sessionStorage.removeItem('outlook_oauth_state')
  
  if (!accessToken || !expiresIn) {
    console.error('[v0] Outlook OAuth missing token')
    return null
  }
  
  const token: CalendarToken = {
    accessToken,
    expiresAt: Date.now() + parseInt(expiresIn) * 1000
  }
  
  saveToken('outlook', token)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  
  return token
}

/**
 * Add event to Outlook Calendar
 */
export async function addOutlookEvent(event: CalendarEvent): Promise<{ success: boolean; message: string; eventId?: string }> {
  const token = getToken('outlook')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Outlook Calendar not connected. Please connect in Settings.' }
  }
  
  try {
    const response = await fetch(`${GRAPH_API}/me/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: event.title,
        body: { contentType: 'text', content: event.description || '' },
        location: event.location ? { displayName: event.location } : undefined,
        start: { dateTime: event.startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: event.endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        isAllDay: event.allDay
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return { success: true, message: `Event added to Outlook Calendar: "${event.title}"`, eventId: data.id }
  } catch (error) {
    return { success: false, message: `Outlook Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Update event in Outlook Calendar
 */
export async function updateOutlookEvent(eventId: string, event: CalendarEvent): Promise<{ success: boolean; message: string }> {
  const token = getToken('outlook')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Outlook Calendar not connected.' }
  }
  
  try {
    const response = await fetch(`${GRAPH_API}/me/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: event.title,
        body: { contentType: 'text', content: event.description || '' },
        location: event.location ? { displayName: event.location } : undefined,
        start: { dateTime: event.startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: event.endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    return { success: true, message: `Event updated in Outlook Calendar: "${event.title}"` }
  } catch (error) {
    return { success: false, message: `Outlook Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * Delete event from Outlook Calendar
 */
export async function deleteOutlookEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  const token = getToken('outlook')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Outlook Calendar not connected.' }
  }
  
  try {
    const response = await fetch(`${GRAPH_API}/me/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`
      }
    })
    
    if (!response.ok && response.status !== 204) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    return { success: true, message: 'Event deleted from Outlook Calendar' }
  } catch (error) {
    return { success: false, message: `Outlook Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

/**
 * List upcoming events from Outlook Calendar
 */
export async function listOutlookEvents(maxResults: number = 10): Promise<{ success: boolean; events?: CalendarEvent[]; message?: string }> {
  const token = getToken('outlook')
  if (!token || token.expiresAt < Date.now()) {
    return { success: false, message: 'Outlook Calendar not connected.' }
  }
  
  try {
    const response = await fetch(
      `${GRAPH_API}/me/calendarView?startDateTime=${new Date().toISOString()}&endDateTime=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}&$top=${maxResults}&$orderby=start/dateTime`, 
      {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`
        }
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const events: CalendarEvent[] = data.value?.map((item: { id: string; subject: string; bodyPreview?: string; location?: { displayName: string }; start: { dateTime: string }; end: { dateTime: string }; isAllDay?: boolean }) => ({
      id: item.id,
      title: item.subject,
      description: item.bodyPreview,
      location: item.location?.displayName,
      startDate: item.start?.dateTime,
      endDate: item.end?.dateTime,
      allDay: item.isAllDay
    })) || []
    
    return { success: true, events }
  } catch (error) {
    return { success: false, message: `Outlook Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// ============================================
// ICS FILE (Universal fallback)
// ============================================

/**
 * Generate and download ICS file
 */
export function downloadICSEvent(event: CalendarEvent): { success: boolean; message: string } {
  try {
    const formatICSDate = (dateStr: string, allDay?: boolean) => {
      const date = new Date(dateStr)
      if (allDay) {
        return date.toISOString().split('T')[0].replace(/-/g, '')
      }
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    
    const escapeText = (text: string) => text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
    
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@voiceagent`
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VoiceAgent//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      event.allDay 
        ? `DTSTART;VALUE=DATE:${formatICSDate(event.startDate, true)}`
        : `DTSTART:${formatICSDate(event.startDate)}`,
      event.allDay
        ? `DTEND;VALUE=DATE:${formatICSDate(event.endDate, true)}`
        : `DTEND:${formatICSDate(event.endDate)}`,
      `SUMMARY:${escapeText(event.title)}`,
      event.description ? `DESCRIPTION:${escapeText(event.description)}` : '',
      event.location ? `LOCATION:${escapeText(event.location)}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n')
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    return { 
      success: true, 
      message: `Event "${event.title}" downloaded as .ics file. Open to add to any calendar app.` 
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to create ICS file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// ============================================
// UNIFIED API
// ============================================

/**
 * Add event using configured provider
 */
export async function addCalendarEvent(event: CalendarEvent, provider?: CalendarProvider): Promise<{ success: boolean; message: string; eventId?: string }> {
  const config = loadCalendarConfig()
  const useProvider = provider || config?.provider || 'ics'
  
  switch (useProvider) {
    case 'google':
      return addGoogleEvent(event)
    case 'outlook':
      return addOutlookEvent(event)
    case 'ics':
    default:
      return downloadICSEvent(event)
  }
}

/**
 * Update event using configured provider
 */
export async function updateCalendarEvent(eventId: string, event: CalendarEvent, provider?: CalendarProvider): Promise<{ success: boolean; message: string }> {
  const config = loadCalendarConfig()
  const useProvider = provider || config?.provider || 'ics'
  
  switch (useProvider) {
    case 'google':
      return updateGoogleEvent(eventId, event)
    case 'outlook':
      return updateOutlookEvent(eventId, event)
    case 'ics':
    default:
      return { success: false, message: 'ICS files cannot be updated. Delete and create a new event.' }
  }
}

/**
 * Delete event using configured provider
 */
export async function deleteCalendarEvent(eventId: string, provider?: CalendarProvider): Promise<{ success: boolean; message: string }> {
  const config = loadCalendarConfig()
  const useProvider = provider || config?.provider || 'ics'
  
  switch (useProvider) {
    case 'google':
      return deleteGoogleEvent(eventId)
    case 'outlook':
      return deleteOutlookEvent(eventId)
    case 'ics':
    default:
      return { success: false, message: 'ICS files cannot be deleted from this app. Remove from your calendar app directly.' }
  }
}

/**
 * List events using configured provider
 */
export async function listCalendarEvents(maxResults: number = 10, provider?: CalendarProvider): Promise<{ success: boolean; events?: CalendarEvent[]; message?: string }> {
  const config = loadCalendarConfig()
  const useProvider = provider || config?.provider || 'ics'
  
  switch (useProvider) {
    case 'google':
      return listGoogleEvents(maxResults)
    case 'outlook':
      return listOutlookEvents(maxResults)
    case 'ics':
    default:
      return { success: false, message: 'Cannot list events without calendar connection. Please connect Google or Outlook.' }
  }
}
