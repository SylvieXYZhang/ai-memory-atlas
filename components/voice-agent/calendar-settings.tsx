'use client'

import { useState, useEffect } from 'react'
import { Check, X, ExternalLink, Calendar, Settings2, Download, AlertCircle } from 'lucide-react'
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
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load config and check connections
  useEffect(() => {
    const savedConfig = loadCalendarConfig()
    if (savedConfig) {
      setConfig(savedConfig)
      setGoogleClientId(savedConfig.googleClientId || '')
      setOutlookClientId(savedConfig.outlookClientId || '')
    } else {
      // Set default config to ICS
      setConfig({ provider: 'ics' })
    }
    setGoogleConnected(isProviderConnected('google'))
    setOutlookConnected(isProviderConnected('outlook'))
    
    // Handle OAuth callbacks
    if (window.location.hash.includes('access_token')) {
      const googleToken = handleGoogleCallback()
      const outlookToken = handleOutlookCallback()
      if (googleToken) {
        setGoogleConnected(true)
        setOauthMessage({ type: 'success', text: 'Google Calendar connected successfully!' })
        // Auto-set as default if connected
        saveCalendarConfig({ ...loadCalendarConfig(), provider: 'google' } as CalendarConfig)
        setConfig(prev => prev ? { ...prev, provider: 'google' } : { provider: 'google' })
      }
      if (outlookToken) {
        setOutlookConnected(true)
        setOauthMessage({ type: 'success', text: 'Outlook Calendar connected successfully!' })
        saveCalendarConfig({ ...loadCalendarConfig(), provider: 'outlook' } as CalendarConfig)
        setConfig(prev => prev ? { ...prev, provider: 'outlook' } : { provider: 'outlook' })
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
        {/* OAuth success/error message */}
        {oauthMessage && (
          <div className={cn(
            "p-3 rounded-lg flex items-center gap-2",
            oauthMessage.type === 'success' ? "bg-green-500/10 border border-green-500/30" : "bg-destructive/10 border border-destructive/30"
          )}>
            {oauthMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
            <p className={cn("text-sm", oauthMessage.type === 'success' ? "text-green-600" : "text-destructive")}>
              {oauthMessage.text}
            </p>
            <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setOauthMessage(null)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Current default */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Default Provider / 默认提供商:</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn(
              "text-sm",
              config?.provider === 'google' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
              config?.provider === 'outlook' ? "bg-blue-600/10 text-blue-700 border-blue-600/30" :
              "bg-muted"
            )}>
              {config?.provider === 'google' ? 'Google Calendar' : 
               config?.provider === 'outlook' ? 'Microsoft Outlook' : 
               'ICS Download (Universal)'}
            </Badge>
            {config?.provider === 'ics' && (
              <span className="text-xs text-muted-foreground">
                No login needed - downloads .ics files for any calendar app
              </span>
            )}
            {(config?.provider === 'google' || config?.provider === 'outlook') && (
              <span className="text-xs text-green-600">
                Direct add/modify/delete supported
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
        <div className={cn(
          "space-y-3 p-4 rounded-lg border",
          config?.provider === 'ics' 
            ? "border-green-500/50 bg-green-500/5" 
            : "border-border bg-muted/30"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-medium">ICS Download (Default)</h3>
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                Always Available
              </Badge>
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
            Downloads .ics files that work with any calendar app including Apple Calendar, Google Calendar, and Outlook.
            下载可用于任何日历应用的.ics文件，包括Apple日历、Google日历和Outlook。
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Apple Calendar</Badge>
            <Badge variant="secondary">Google Calendar</Badge>
            <Badge variant="secondary">Outlook</Badge>
            <Badge variant="secondary">Any .ics compatible app</Badge>
          </div>
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
