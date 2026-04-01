'use client'

import { useState, useEffect } from 'react'
import { Check, X, ExternalLink, Calendar, Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  loadCalendarConfig,
  saveCalendarConfig,
  isProviderConnected,
  disconnectProvider,
  initiateGoogleAuth,
  initiateOutlookAuth,
  handleGoogleCallback,
  handleOutlookCallback,
  type CalendarProvider,
  type CalendarConfig
} from '@/lib/services/calendar'

interface CalendarSettingsProps {
  onClose?: () => void
}

export function CalendarSettings({ onClose }: CalendarSettingsProps) {
  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [googleClientId, setGoogleClientId] = useState('')
  const [outlookClientId, setOutlookClientId] = useState('')
  const [googleConnected, setGoogleConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)

  // Load config and check connections
  useEffect(() => {
    const savedConfig = loadCalendarConfig()
    if (savedConfig) {
      setConfig(savedConfig)
      setGoogleClientId(savedConfig.googleClientId || '')
      setOutlookClientId(savedConfig.outlookClientId || '')
    }
    setGoogleConnected(isProviderConnected('google'))
    setOutlookConnected(isProviderConnected('outlook'))
    
    // Handle OAuth callbacks
    if (window.location.hash.includes('access_token')) {
      const googleToken = handleGoogleCallback()
      const outlookToken = handleOutlookCallback()
      if (googleToken) {
        setGoogleConnected(true)
      }
      if (outlookToken) {
        setOutlookConnected(true)
      }
    }
  }, [])

  const handleSaveConfig = () => {
    const newConfig: CalendarConfig = {
      provider: googleConnected ? 'google' : outlookConnected ? 'outlook' : 'ics',
      googleClientId: googleClientId || undefined,
      outlookClientId: outlookClientId || undefined
    }
    saveCalendarConfig(newConfig)
    setConfig(newConfig)
  }

  const handleConnectGoogle = () => {
    if (!googleClientId) {
      alert('Please enter your Google Client ID first')
      return
    }
    handleSaveConfig()
    const redirectUri = `${window.location.origin}${window.location.pathname}`
    initiateGoogleAuth(googleClientId, redirectUri)
  }

  const handleConnectOutlook = () => {
    if (!outlookClientId) {
      alert('Please enter your Outlook Client ID first')
      return
    }
    handleSaveConfig()
    const redirectUri = `${window.location.origin}${window.location.pathname}`
    initiateOutlookAuth(outlookClientId, redirectUri)
  }

  const handleDisconnect = (provider: 'google' | 'outlook') => {
    disconnectProvider(provider)
    if (provider === 'google') {
      setGoogleConnected(false)
    } else {
      setOutlookConnected(false)
    }
    handleSaveConfig()
  }

  const handleSetDefaultProvider = (provider: CalendarProvider) => {
    const newConfig: CalendarConfig = {
      ...config,
      provider,
      googleClientId: googleClientId || undefined,
      outlookClientId: outlookClientId || undefined
    }
    saveCalendarConfig(newConfig)
    setConfig(newConfig)
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            <CardTitle>Calendar Integration / 日历集成</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Connect your calendar to add, modify, and delete events with voice commands.
          连接日历以使用语音命令添加、修改和删除事件。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current default */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Default Provider / 默认提供商:</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {config?.provider === 'google' ? 'Google Calendar' : 
               config?.provider === 'outlook' ? 'Microsoft Outlook' : 
               'ICS Download (Universal)'}
            </Badge>
            {config?.provider === 'ics' && (
              <span className="text-xs text-muted-foreground">
                Works with all calendar apps
              </span>
            )}
          </div>
        </div>

        {/* Google Calendar */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="font-medium">Google Calendar</h3>
              {googleConnected && (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
            {googleConnected && config?.provider !== 'google' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSetDefaultProvider('google')}
              >
                Set as Default
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="google-client-id" className="text-sm">
              OAuth Client ID
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Get from Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
            </Label>
            <Input
              id="google-client-id"
              type="text"
              placeholder="123456789-abc.apps.googleusercontent.com"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              disabled={googleConnected}
            />
          </div>

          <div className="flex gap-2">
            {googleConnected ? (
              <Button 
                variant="outline" 
                className="text-destructive"
                onClick={() => handleDisconnect('google')}
              >
                Disconnect
              </Button>
            ) : (
              <Button onClick={handleConnectGoogle} disabled={!googleClientId}>
                Connect Google Calendar
              </Button>
            )}
          </div>
        </div>

        {/* Outlook Calendar */}
        <div className="space-y-3 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium">Microsoft Outlook</h3>
              {outlookConnected && (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <Check className="w-3 h-3 mr-1" /> Connected
                </Badge>
              )}
            </div>
            {outlookConnected && config?.provider !== 'outlook' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSetDefaultProvider('outlook')}
              >
                Set as Default
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outlook-client-id" className="text-sm">
              Application (Client) ID
              <a 
                href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Get from Azure Portal <ExternalLink className="w-3 h-3" />
              </a>
            </Label>
            <Input
              id="outlook-client-id"
              type="text"
              placeholder="12345678-1234-1234-1234-123456789abc"
              value={outlookClientId}
              onChange={(e) => setOutlookClientId(e.target.value)}
              disabled={outlookConnected}
            />
          </div>

          <div className="flex gap-2">
            {outlookConnected ? (
              <Button 
                variant="outline" 
                className="text-destructive"
                onClick={() => handleDisconnect('outlook')}
              >
                Disconnect
              </Button>
            ) : (
              <Button onClick={handleConnectOutlook} disabled={!outlookClientId}>
                Connect Outlook Calendar
              </Button>
            )}
          </div>
        </div>

        {/* ICS Fallback */}
        <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-medium">ICS Download (Universal)</h3>
              <Badge variant="outline" className="text-xs">Always Available</Badge>
            </div>
            {config?.provider !== 'ics' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSetDefaultProvider('ics')}
              >
                Set as Default
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Downloads .ics files that work with any calendar app including Apple Calendar.
            下载可用于任何日历应用的.ics文件，包括Apple日历。
          </p>
        </div>

        {/* Help text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Setup instructions / 设置说明:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>For Google: Create a project in Google Cloud Console, enable Calendar API, create OAuth credentials</li>
            <li>For Outlook: Register an app in Azure Portal, add Calendars.ReadWrite permission</li>
            <li>Add this URL as authorized redirect URI: <code className="bg-muted px-1 rounded">{typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''}</code></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
