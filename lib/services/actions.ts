// Action Service - Parse and execute user actions
// Supports: Calendar, Reminders, Tasks, Timers

import type { ParsedAction, ActionCategory } from '../types'
import { type Provider, getProviderInfo } from '../api-config'

interface LLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Parse user input to extract action details
 */
export async function parseAction(
  text: string,
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen-max'
): Promise<ParsedAction> {
  if (!apiKey) {
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
  "eventDate": "YYYY-MM-DD or relative like 'tomorrow' / 日期",
  "eventTime": "HH:MM (24h format) / 开始时间",
  "eventEndTime": "HH:MM (24h format, optional) / 结束时间",
  "eventLocation": "Location if mentioned / 地点",
  
  // For reminders / 提醒:
  "reminderTime": "When to remind (date/time or relative) / 提醒时间",
  
  // For tasks / 任务:
  "taskPriority": "low" | "medium" | "high",
  "taskDueDate": "Due date if mentioned / 截止日期",
  
  // For timers / 计时器:
  "timerDuration": number (in minutes / 分钟数)
}

IMPORTANT / 重要:
- Detect the language and respond in the SAME language for title and description.
- 检测语言并用相同语言回复标题和描述。
- Only include fields relevant to the detected category.
- 只包含与检测到的类别相关的字段。
- Return valid JSON only.
- 只返回有效的JSON。`

  try {
    const providerInfo = getProviderInfo(provider)
    
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
            content: 'You are an action parser. Extract structured action data from natural language. Always respond with valid JSON. 你是一个操作解析器，从自然语言中提取结构化操作数据，始终返回有效的JSON。' 
          },
          { role: 'user', content: prompt }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as LLMResponse
    const content = data.choices?.[0]?.message?.content || ''
    
    // Parse JSON from response
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                     content.match(/```\n?([\s\S]*?)\n?```/) ||
                     [null, content]
    const jsonStr = jsonMatch[1] || content
    const parsed = JSON.parse(jsonStr)
    
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
  } catch {
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
  const reminderKeywords = ['remind', 'reminder', 'don\'t forget', 'alert',
    '提醒', '别忘了', '记得']
  const taskKeywords = ['task', 'todo', 'to-do', 'add to list', 'need to',
    '任务', '待办', '需要做']
  const timerKeywords = ['timer', 'countdown', 'set timer', 'minutes', 'hours',
    '计时', '倒计时', '分钟', '小时']
  
  if (calendarKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'calendar'
  } else if (reminderKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'reminder'
  } else if (taskKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'task'
  } else if (timerKeywords.some(kw => lower.includes(kw) || text.includes(kw))) {
    category = 'timer'
  }
  
  // Extract time patterns
  const timeMatch = text.match(/(\d{1,2})[:\.]?(\d{2})?\s*(am|pm|AM|PM)?/)
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  const durationMatch = text.match(/(\d+)\s*(minute|min|hour|hr|分钟|小时)/i)
  
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    description: text,
    originalText: text,
    timestamp: Date.now(),
    status: 'pending',
    eventTime: timeMatch ? `${timeMatch[1]}:${timeMatch[2] || '00'}` : undefined,
    eventDate: dateMatch ? `${dateMatch[3] || new Date().getFullYear()}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}` : undefined,
    timerDuration: durationMatch ? parseInt(durationMatch[1]) * (durationMatch[2].toLowerCase().includes('hour') || durationMatch[2].includes('小时') ? 60 : 1) : undefined
  }
}

/**
 * Execute an action (mock implementation)
 * In production, this would integrate with actual services
 */
export async function executeAction(action: ParsedAction): Promise<{ success: boolean; message: string }> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  switch (action.category) {
    case 'calendar':
      return {
        success: true,
        message: `Calendar event "${action.title}" created for ${action.eventDate || 'today'} at ${action.eventTime || 'all day'}${action.eventLocation ? ` at ${action.eventLocation}` : ''}.`
      }
    
    case 'reminder':
      return {
        success: true,
        message: `Reminder set: "${action.title}" for ${action.reminderTime || 'later'}.`
      }
    
    case 'task':
      return {
        success: true,
        message: `Task added: "${action.title}" with ${action.taskPriority || 'medium'} priority${action.taskDueDate ? `, due ${action.taskDueDate}` : ''}.`
      }
    
    case 'timer':
      return {
        success: true,
        message: `Timer set for ${action.timerDuration || 5} minutes: "${action.title}".`
      }
    
    default:
      return {
        success: false,
        message: `Unknown action category: ${action.category}. Please try rephrasing your request.`
      }
  }
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
