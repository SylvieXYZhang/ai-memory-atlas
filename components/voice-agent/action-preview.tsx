'use client'

import { Calendar, Bell, CheckSquare, Timer, Zap, MapPin, Clock, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ParsedAction, ActionCategory, CalendarOperation } from '@/lib/types'

interface ActionPreviewProps {
  action: ParsedAction
  onConfirm: () => void
  onCancel: () => void
  isExecuting?: boolean
}

const categoryIcons: Record<ActionCategory, typeof Calendar> = {
  calendar: Calendar,
  reminder: Bell,
  task: CheckSquare,
  timer: Timer,
  unknown: Zap
}

const categoryColors: Record<ActionCategory, string> = {
  calendar: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  reminder: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  task: 'text-green-500 bg-green-500/10 border-green-500/30',
  timer: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  unknown: 'text-muted-foreground bg-muted/50 border-border'
}

const categoryLabels: Record<ActionCategory, { en: string; cn: string }> = {
  calendar: { en: 'Calendar Event', cn: '日历事件' },
  reminder: { en: 'Reminder', cn: '提醒' },
  task: { en: 'Task', cn: '任务' },
  timer: { en: 'Timer', cn: '计时器' },
  unknown: { en: 'Action', cn: '操作' }
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Pending / 待确认' },
  confirmed: { icon: Loader2, color: 'text-blue-500', label: 'Executing / 执行中' },
  executed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed / 已完成' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: 'Cancelled / 已取消' },
  failed: { icon: AlertCircle, color: 'text-destructive', label: 'Failed / 失败' }
}

const calendarOperationLabels: Record<CalendarOperation, { en: string; cn: string; color: string }> = {
  add: { en: 'Add Event', cn: '添加事件', color: 'bg-green-500/20 text-green-600 border-green-500/30' },
  modify: { en: 'Modify Event', cn: '修改事件', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  delete: { en: 'Delete Event', cn: '删除事件', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
  list: { en: 'List Events', cn: '列出事件', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' }
}

// Get action hint based on category and operation
function getActionHint(category: ActionCategory, operation?: CalendarOperation): { en: string; cn: string } {
  if (category === 'calendar') {
    switch (operation) {
      case 'add':
        return { 
          en: 'Adds event to your connected calendar (Google/Outlook) or downloads .ics file', 
          cn: '将事件添加到已连接的日历（Google/Outlook）或下载.ics文件' 
        }
      case 'modify':
        return { 
          en: 'Updates the event in your connected calendar', 
          cn: '更新已连接日历中的事件' 
        }
      case 'delete':
        return { 
          en: 'Removes the event from your connected calendar', 
          cn: '从已连接日历中删除事件' 
        }
      case 'list':
        return { 
          en: 'Shows upcoming events from your connected calendar', 
          cn: '显示已连接日历中的即将到来的事件' 
        }
      default:
        return { 
          en: 'Adds event to your calendar', 
          cn: '将事件添加到日历' 
        }
    }
  }
  
  const hints: Record<ActionCategory, { en: string; cn: string }> = {
    calendar: { en: 'Adds event to your calendar', cn: '将事件添加到日历' },
    reminder: { en: 'Sets a browser notification at the specified time', cn: '在指定时间发送浏览器通知提醒' },
    task: { en: 'Saves task locally, viewable in History panel', cn: '本地保存任务，可在历史面板查看' },
    timer: { en: 'Starts countdown, notifies when complete', cn: '开始倒计时，完成时发送通知' },
    unknown: { en: 'Action type not recognized', cn: '未识别的操作类型' }
  }
  
  return hints[category] || hints.unknown
}

export function ActionPreview({ action, onConfirm, onCancel, isExecuting }: ActionPreviewProps) {
  const Icon = categoryIcons[action.category] || Zap
  const colorClass = categoryColors[action.category] || categoryColors.unknown
  const labels = categoryLabels[action.category] || categoryLabels.unknown
  const hints = getActionHint(action.category, action.calendarOperation)
  const status = statusConfig[action.status]
  const StatusIcon = status.icon
  const calendarOp = action.category === 'calendar' && action.calendarOperation 
    ? calendarOperationLabels[action.calendarOperation] 
    : null

  return (
    <Card className={cn('border-2 transition-all', colorClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', colorClass)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{action.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={cn('text-xs', colorClass)}>
                  {labels.en} / {labels.cn}
                </Badge>
                {calendarOp && (
                  <Badge variant="outline" className={cn('text-xs', calendarOp.color)}>
                    {calendarOp.en} / {calendarOp.cn}
                  </Badge>
                )}
                <div className={cn('flex items-center gap-1 text-xs', status.color)}>
                  <StatusIcon className={cn('w-3 h-3', isExecuting && 'animate-spin')} />
                  <span>{status.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Original text */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Original / 原文:</p>
          <p className="text-sm text-foreground/80">{action.originalText}</p>
        </div>

        {/* Parsed details */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Parsed Details / 解析详情
          </p>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            {action.category === 'calendar' && (
              <>
                {action.eventDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{action.eventDate}</span>
                  </div>
                )}
                {action.eventTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{action.eventTime}{action.eventEndTime ? ` - ${action.eventEndTime}` : ''}</span>
                  </div>
                )}
                {action.eventLocation && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{action.eventLocation}</span>
                  </div>
                )}
              </>
            )}
            
            {action.category === 'reminder' && action.reminderTime && (
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span>{action.reminderTime}</span>
              </div>
            )}
            
            {action.category === 'task' && (
              <>
                {action.taskPriority && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        action.taskPriority === 'high' && 'border-red-500 text-red-500',
                        action.taskPriority === 'medium' && 'border-amber-500 text-amber-500',
                        action.taskPriority === 'low' && 'border-green-500 text-green-500'
                      )}
                    >
                      {action.taskPriority}
                    </Badge>
                  </div>
                )}
                {action.taskDueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Due: {action.taskDueDate}</span>
                  </div>
                )}
              </>
            )}
            
            {action.category === 'timer' && action.timerDuration && (
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span>{action.timerDuration} minutes / 分钟</span>
              </div>
            )}
          </div>
        </div>

        {/* Execution result */}
        {action.executionResult && (
          <div className={cn(
            'p-3 rounded-lg border',
            action.status === 'executed' ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'
          )}>
            <p className="text-sm">{action.executionResult}</p>
          </div>
        )}
        
        {action.executionError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">{action.executionError}</p>
          </div>
        )}

        {/* What will happen hint */}
        {action.status === 'pending' && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">What will happen / 将执行的操作:</p>
            <p className="text-sm">{hints.en}</p>
            <p className="text-sm text-muted-foreground">{hints.cn}</p>
          </div>
        )}

        {/* Action buttons */}
        {action.status === 'pending' && (
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onConfirm}
              disabled={isExecuting}
              className="flex-1 gap-2"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm & Execute / 确认执行
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isExecuting}
              className="gap-2"
            >
              <XCircle className="w-4 h-4" />
              Cancel / 取消
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
