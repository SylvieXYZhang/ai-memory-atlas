// Action Service - Parse and execute user actions
// Supports: Calendar (ICS), Reminders (Browser Notifications), Tasks (Local), Timers
//
// FEASIBILITY RESEARCH LOG:
// ================================
// 1. CALENDAR EVENTS
//    - Google Calendar API: Requires OAuth + GCP project. HIGH complexity for users.
//    - Apple Calendar: No web API. Requires native app integration.
//    - ICS File Download: UNIVERSAL. Works with all calendar apps. LOW complexity.
//    - DECISION: Use ICS file generation. User downloads and imports to their preferred calendar.
//
// 2. REMINDERS / NOTIFICATIONS
//    - Browser Notifications API: Native, requires HTTPS + user permission. LOW complexity.
//    - Push Notifications: Requires service worker + push server. MEDIUM complexity.
//    - DECISION: Use Browser Notifications API for immediate reminders.
//
// 3. TASKS / TODOS
//    - Todoist API: Requires API token from user. MEDIUM complexity.
//    - Microsoft To Do: Requires Microsoft Graph API + OAuth. HIGH complexity.
//    - Local Storage: Works offline, no external deps. LOW complexity.
//    - DECISION: Store tasks locally for MVP, with export option.
//
// 4. TIMERS
//    - Browser setTimeout + Notification: Native, works everywhere. LOW complexity.
//    - DECISION: Use setTimeout with browser notification on completion.

import type { ParsedAction, ActionCategory } from '../types'
import { type Provider, getProviderInfo } from '../api-config'

interface LLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// Storage keys
const TASKS_STORAGE_KEY = 'voiceagent_tasks'
const TIMERS_STORAGE_KEY = 'voiceagent_active_timers'

// Track active timers in memory
const activeTimers: Map<string, NodeJS.Timeout> = new Map()

/**
 * Parse user input to extract action details
 */
export async function parseAction(
  text: string,
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen-max'
): Promise<ParsedAction> {
  console.log('[v0] parseAction called with:', { text: text.slice(0, 50), provider, model, hasApiKey: !!apiKey })
  
  if (!apiKey) {
    console.log('[v0] No API key, using local parsing')
    return parseActionLocal(text)
  }

  const prompt = `Analyze the following user input and extract action details.
分析以下用户输入并提取操作详情。

User input / 用户输入: "${text}"

Extract the action into JSON format / 将操作提取为JSON格式:
{
  "category": "calendar" | "reminder" | "task" | "timer",
  "title": "Brief title for the action / 操作的简短标题",
  "description": "Detailed description / 详细描述",
  
  // For calendar events / 日历事件:
  "eventDate": "YYYY-MM-DD format / 日期格式",
  "eventTime": "HH:MM (24h format) / 开始时间",
  "eventEndTime": "HH:MM (24h format, optional) / 结束时间",
  "eventLocation": "Location if mentioned / 地点",
  
  // For reminders / 提醒:
  "reminderTime": "ISO datetime or relative like 'in 30 minutes' / 提醒时间",
  
  // For tasks / 任务:
  "taskPriority": "low" | "medium" | "high",
  "taskDueDate": "YYYY-MM-DD / 截止日期",
  
  // For timers / 计时器:
  "timerDuration": number (in minutes / 分钟数)
}

IMPORTANT / 重要:
- For dates, convert relative terms (today, tomorrow, next Monday) to actual YYYY-MM-DD.
- 对于日期，将相对术语（今天、明天、下周一）转换为实际的YYYY-MM-DD。
- Detect the language and respond in the SAME language for title and description.
- 检测语言并用相同语言回复标题和描述。
- Only include fields relevant to the detected category.
- 只包含与检测到的类别相关的字段。
- Return valid JSON only.
- 只返回有效的JSON。`

  try {
    const providerInfo = getProviderInfo(provider)
    console.log('[v0] Calling LLM for action parsing:', providerInfo.chatEndpoint)
    
    const response = await fetch(providerInfo.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          { 
            role: 'system', 
            content: 'You are an action parser. Extract structured action data from natural language. Always respond with valid JSON only, no markdown. 你是一个操作解析器，从自然语言中提取结构化操作数据，只返回有效的JSON，不要markdown。' 
          },
          { role: 'user', content: prompt }
        ]
      })
    })

    if (!response.ok) {
      console.log('[v0] LLM request failed:', response.status)
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as LLMResponse
    const content = data.choices?.[0]?.message?.content || ''
    console.log('[v0] LLM response:', content.slice(0, 200))
    
    // Parse JSON from response
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                     content.match(/```\n?([\s\S]*?)\n?```/) ||
                     [null, content]
    const jsonStr = (jsonMatch[1] || content).trim()
    const parsed = JSON.parse(jsonStr)
    
    console.log('[v0] Parsed action:', parsed)
    
    return {
      id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: parsed.category || 'unknown',
      title: parsed.title || 'Untitled Action',
      description: parsed.description || text,
      originalText: text,
      timestamp: Date.now(),
      status: 'pending',
      eventDate: parsed.eventDate,
      eventTime: parsed.eventTime,
      eventEndTime: parsed.eventEndTime,
      eventLocation: parsed.eventLocation,
      reminderTime: parsed.reminderTime,
      taskPriority: parsed.taskPriority,
      taskDueDate: parsed.taskDueDate,
      timerDuration: parsed.timerDuration
    }
  } catch (error) {
    console.log('[v0] Action parsing error, falling back to local:', error)
    return parseActionLocal(text)
  }
}

/**
 * Local action parsing using keywords (fallback)
 */
function parseActionLocal(text: string): ParsedAction {
  const lower = text.toLowerCase()
  let category: ActionCategory = 'unknown'
  
  // Detect category from keywords
  const calendarKeywords = ['calendar', 'event', 'meeting', 'appointment', 'schedule', 'dinner', 'party', 'conference',
    '日历', '日程', '会议', '约会', '活动', '聚会', '晚餐']
  const reminderKeywords = ['remind', 'reminder', 'don\'t forget', 'alert', 'notify',
    '提醒', '别忘了', '记得', '通知']
  const taskKeywords = ['task', 'todo', 'to-do', 'add to list', 'need to',
    '任务', '待办', '需要做']
  const timerKeywords = ['timer', 'countdown', 'set timer', 'minutes from now', 'hours from now',
    '计时', '倒计时', '分钟后', '小时后']
  
  if (timerKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'timer'
  } else if (calendarKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'calendar'
  } else if (reminderKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'reminder'
  } else if (taskKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'task'
  }
  
  // Extract time patterns
  const timeMatch = text.match(/(\d{1,2})[:\.](\d{2})?\s*(am|pm|AM|PM)?/)
  const durationMatch = text.match(/(\d+)\s*(minute|min|hour|hr|分钟|小时)/i)
  
  // Try to extract date
  const today = new Date()
  let eventDate: string | undefined
  
  if (lower.includes('today') || text.includes('今天')) {
    eventDate = today.toISOString().split('T')[0]
  } else if (lower.includes('tomorrow') || text.includes('明天')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    eventDate = tomorrow.toISOString().split('T')[0]
  }
  
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    description: text,
    originalText: text,
    timestamp: Date.now(),
    status: 'pending',
    eventTime: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2] || '00'}` : undefined,
    eventDate,
    timerDuration: durationMatch ? parseInt(durationMatch[1]) * (durationMatch[2].toLowerCase().includes('hour') || durationMatch[2].includes('小时') ? 60 : 1) : undefined
  }
}

/**
 * Execute an action - REAL IMPLEMENTATIONS
 */
export async function executeAction(action: ParsedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log('[v0] executeAction called:', action.category, action.title)
  
  switch (action.category) {
    case 'calendar':
      return executeCalendarAction(action)
    
    case 'reminder':
      return executeReminderAction(action)
    
    case 'task':
      return executeTaskAction(action)
    
    case 'timer':
      return executeTimerAction(action)
    
    default:
      return {
        success: false,
        message: `Unknown action category: ${action.category}. Supported: calendar, reminder, task, timer.`
      }
  }
}

/**
 * CALENDAR: Generate and download ICS file
 * Works with: Google Calendar, Apple Calendar, Outlook, etc.
 */
async function executeCalendarAction(action: ParsedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log('[v0] Executing calendar action - generating ICS file')
  
  try {
    // Parse date and time
    const eventDate = action.eventDate || new Date().toISOString().split('T')[0]
    const startTime = action.eventTime || '09:00'
    const endTime = action.eventEndTime || calculateEndTime(startTime, 60) // Default 1 hour
    
    // Create datetime strings
    const startDateTime = new Date(`${eventDate}T${startTime}:00`)
    const endDateTime = new Date(`${eventDate}T${endTime}:00`)
    
    // Format for ICS (YYYYMMDDTHHMMSS)
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    
    // Generate ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VoiceAgent//Calendar Event//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${action.id}@voiceagent`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDateTime)}`,
      `DTEND:${formatICSDate(endDateTime)}`,
      `SUMMARY:${escapeICSText(action.title)}`,
      `DESCRIPTION:${escapeICSText(action.description)}`,
      action.eventLocation ? `LOCATION:${escapeICSText(action.eventLocation)}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n')
    
    // Create and download file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${action.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    console.log('[v0] ICS file downloaded successfully')
    
    return {
      success: true,
      message: `Calendar event "${action.title}" downloaded as .ics file. Open it to add to your calendar app (Google Calendar, Apple Calendar, Outlook, etc.).`,
      data: { filename: link.download, date: eventDate, time: startTime }
    }
  } catch (error) {
    console.log('[v0] Calendar action failed:', error)
    return {
      success: false,
      message: `Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * REMINDER: Use Browser Notifications API
 */
async function executeReminderAction(action: ParsedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log('[v0] Executing reminder action')
  
  // Check if notifications are supported
  if (!('Notification' in window)) {
    return {
      success: false,
      message: 'Browser notifications are not supported. Please use a modern browser like Chrome, Firefox, or Edge.'
    }
  }
  
  // Request permission if needed
  if (Notification.permission === 'denied') {
    return {
      success: false,
      message: 'Notification permission denied. Please enable notifications in your browser settings.'
    }
  }
  
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission not granted. Please allow notifications to use reminders.'
      }
    }
  }
  
  // Calculate delay from reminderTime
  let delayMs = 0
  if (action.reminderTime) {
    // Try to parse relative time like "in 30 minutes" or "30分钟后"
    const minutesMatch = action.reminderTime.match(/(\d+)\s*(minute|min|分钟)/i)
    const hoursMatch = action.reminderTime.match(/(\d+)\s*(hour|hr|小时)/i)
    
    if (minutesMatch) {
      delayMs = parseInt(minutesMatch[1]) * 60 * 1000
    } else if (hoursMatch) {
      delayMs = parseInt(hoursMatch[1]) * 60 * 60 * 1000
    } else {
      // Try to parse as datetime
      const targetDate = new Date(action.reminderTime)
      if (!isNaN(targetDate.getTime())) {
        delayMs = targetDate.getTime() - Date.now()
      }
    }
  }
  
  // Default to 5 minutes if no time specified
  if (delayMs <= 0) {
    delayMs = 5 * 60 * 1000
  }
  
  // Set the reminder
  const timerId = setTimeout(() => {
    new Notification('VoiceAgent Reminder', {
      body: action.title,
      icon: '/favicon.ico',
      tag: action.id,
      requireInteraction: true
    })
    console.log('[v0] Reminder notification shown:', action.title)
  }, delayMs)
  
  // Store timer reference
  activeTimers.set(action.id, timerId)
  
  const delayMinutes = Math.round(delayMs / 60000)
  console.log('[v0] Reminder set for', delayMinutes, 'minutes')
  
  return {
    success: true,
    message: `Reminder set: "${action.title}" will notify you in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}.`,
    data: { delayMinutes, timerId: action.id }
  }
}

/**
 * TASK: Store in localStorage
 */
async function executeTaskAction(action: ParsedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log('[v0] Executing task action - storing locally')
  
  try {
    // Load existing tasks
    const existingTasks = loadTasks()
    
    // Create new task
    const task = {
      id: action.id,
      title: action.title,
      description: action.description,
      priority: action.taskPriority || 'medium',
      dueDate: action.taskDueDate,
      createdAt: new Date().toISOString(),
      completed: false
    }
    
    // Save task
    existingTasks.unshift(task)
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(existingTasks))
    
    console.log('[v0] Task saved:', task.id)
    
    return {
      success: true,
      message: `Task added: "${action.title}" (${task.priority} priority)${task.dueDate ? `, due ${task.dueDate}` : ''}. View in History panel.`,
      data: task
    }
  } catch (error) {
    console.log('[v0] Task action failed:', error)
    return {
      success: false,
      message: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * TIMER: Set countdown with browser notification
 */
async function executeTimerAction(action: ParsedAction): Promise<{ success: boolean; message: string; data?: unknown }> {
  console.log('[v0] Executing timer action')
  
  // Check notification support
  if (!('Notification' in window)) {
    return {
      success: false,
      message: 'Browser notifications are not supported. Timer requires notification capability.'
    }
  }
  
  // Request permission
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission required for timer alerts.'
      }
    }
  }
  
  const durationMinutes = action.timerDuration || 5
  const durationMs = durationMinutes * 60 * 1000
  
  // Set timer
  const timerId = setTimeout(() => {
    new Notification('VoiceAgent Timer Complete', {
      body: `Timer finished: ${action.title}`,
      icon: '/favicon.ico',
      tag: action.id,
      requireInteraction: true
    })
    
    // Also play a sound if possible
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC0cMLTd44OeSUkxls/igJRgTjm038SJnmRLMJLT44GXYVA0qt7fipliSy6Sz+OBlmFONKrf34qZYkkukM/jgpZhTzSq3+CKmWFKLo/P44KWYk80qt/fiphgSi2Oz+OClmJPM6rf4IqYYEotjs/jgpZiTzSq39+KmGBKLY7P44KWYk80qt/giphhSi2Oz+OClmJPNKrf34qYYEotjs/jgpZiTzSq3+CKmGBKLY7P44KWYQ==')
      audio.play().catch(() => {})
    } catch {
      // Ignore audio errors
    }
    
    console.log('[v0] Timer completed:', action.title)
    activeTimers.delete(action.id)
  }, durationMs)
  
  activeTimers.set(action.id, timerId)
  
  // Store timer info
  saveActiveTimer(action.id, Date.now() + durationMs, action.title)
  
  console.log('[v0] Timer set for', durationMinutes, 'minutes')
  
  return {
    success: true,
    message: `Timer set for ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}: "${action.title}". You'll be notified when it's done.`,
    data: { durationMinutes, endTime: new Date(Date.now() + durationMs).toISOString() }
  }
}

// Helper functions

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}

function loadTasks(): Array<{
  id: string
  title: string
  description: string
  priority: string
  dueDate?: string
  createdAt: string
  completed: boolean
}> {
  try {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveActiveTimer(id: string, endTime: number, title: string) {
  try {
    const timers = JSON.parse(localStorage.getItem(TIMERS_STORAGE_KEY) || '{}')
    timers[id] = { endTime, title }
    localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(timers))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Cancel an active timer or reminder
 */
export function cancelAction(actionId: string): boolean {
  const timer = activeTimers.get(actionId)
  if (timer) {
    clearTimeout(timer)
    activeTimers.delete(actionId)
    console.log('[v0] Action cancelled:', actionId)
    return true
  }
  return false
}

/**
 * Get all stored tasks
 */
export function getTasks() {
  return loadTasks()
}

/**
 * Get icon name for action category
 */
export function getActionIcon(category: ActionCategory): string {
  switch (category) {
    case 'calendar': return 'Calendar'
    case 'reminder': return 'Bell'
    case 'task': return 'CheckSquare'
    case 'timer': return 'Timer'
    default: return 'Zap'
  }
}

/**
 * Get color for action category
 */
export function getActionColor(category: ActionCategory): string {
  switch (category) {
    case 'calendar': return 'text-blue-500'
    case 'reminder': return 'text-amber-500'
    case 'task': return 'text-green-500'
    case 'timer': return 'text-purple-500'
    default: return 'text-muted-foreground'
  }
}
