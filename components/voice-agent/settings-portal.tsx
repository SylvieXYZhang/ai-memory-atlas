'use client'

import { useState, useEffect, useCallback } from 'react'
import { Key, Cpu, Check, AlertCircle, ChevronDown, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  type Provider,
  type FunctionType,
  type UserAPIConfig,
  PROVIDERS,
  FUNCTION_INFO,
  getDefaultConfig,
  loadAPIConfig,
  saveAPIConfig,
  getAPIKey,
  getAssignment,
  getProviderInfo,
  isFunctionConfigured,
  validateAPIConfig,
} from '@/lib/api-config'
import { CalendarSettings } from './calendar-settings'

interface SettingsPortalProps {
  onConfigChange?: (config: UserAPIConfig) => void
  onClose?: () => void
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'

interface FunctionValidation {
  state: ValidationState
  error?: string
}

export function SettingsPortal({ onConfigChange, onClose }: SettingsPortalProps) {
  const [config, setConfig] = useState<UserAPIConfig>(getDefaultConfig())
  const [visibleKeys, setVisibleKeys] = useState<Set<Provider>>(new Set())
  const [activeTab, setActiveTab] = useState<'keys' | 'models' | 'calendar'>('keys')
  const [validations, setValidations] = useState<Record<FunctionType, FunctionValidation>>({
    asr: { state: 'idle' },
    intent: { state: 'idle' },
    summary: { state: 'idle' },
    research: { state: 'idle' }
  })

  // Load config on mount
  useEffect(() => {
    const loaded = loadAPIConfig()
    setConfig(loaded)
    // Set initial validation states from saved config
    const newValidations: Record<FunctionType, FunctionValidation> = {
      asr: { state: 'idle' },
      intent: { state: 'idle' },
      summary: { state: 'idle' },
      research: { state: 'idle' }
    }
    for (const assignment of loaded.assignments) {
      if (assignment.validated) {
        newValidations[assignment.function] = { state: 'valid' }
      } else if (assignment.lastError) {
        newValidations[assignment.function] = { state: 'invalid', error: assignment.lastError }
      }
    }
    setValidations(newValidations)
  }, [])

  // Save and notify on config change
  const updateConfig = useCallback((newConfig: UserAPIConfig) => {
    setConfig(newConfig)
    saveAPIConfig(newConfig)
    onConfigChange?.(newConfig)
  }, [onConfigChange])

  // Update API key for a provider
  const handleKeyChange = (provider: Provider, key: string) => {
    const newKeys = config.keys.filter(k => k.provider !== provider)
    if (key) {
      newKeys.push({ provider, key })
    }
    // Reset validation for functions using this provider
    const newAssignments = config.assignments.map(a => 
      a.provider === provider ? { ...a, validated: false, lastError: undefined } : a
    )
    const newValidations = { ...validations }
    for (const a of config.assignments) {
      if (a.provider === provider) {
        newValidations[a.function] = { state: 'idle' }
      }
    }
    setValidations(newValidations)
    updateConfig({ keys: newKeys, assignments: newAssignments })
  }

  // Update model assignment for a function
  const handleAssignmentChange = (func: FunctionType, provider: Provider, model: string) => {
    const newAssignments = config.assignments.map(a => 
      a.function === func 
        ? { function: func, provider, model, validated: false, lastError: undefined } 
        : a
    )
    // Reset validation for this function
    setValidations(prev => ({ ...prev, [func]: { state: 'idle' } }))
    updateConfig({ ...config, assignments: newAssignments })
  }

  // Validate a specific function's configuration
  const handleValidate = async (func: FunctionType) => {
    const assignment = getAssignment(config, func)
    const apiKey = getAPIKey(config, assignment.provider)

    setValidations(prev => ({ ...prev, [func]: { state: 'validating' } }))

    const result = await validateAPIConfig(
      assignment.provider,
      apiKey,
      assignment.model,
      func
    )

    if (result.valid) {
      setValidations(prev => ({ ...prev, [func]: { state: 'valid' } }))
      // Update config to mark as validated
      const newAssignments = config.assignments.map(a => 
        a.function === func ? { ...a, validated: true, lastError: undefined } : a
      )
      updateConfig({ ...config, assignments: newAssignments })
    } else {
      setValidations(prev => ({ ...prev, [func]: { state: 'invalid', error: result.error } }))
      // Update config with error
      const newAssignments = config.assignments.map(a => 
        a.function === func ? { ...a, validated: false, lastError: result.error } : a
      )
      updateConfig({ ...config, assignments: newAssignments })
    }
  }

  // Validate all functions
  const handleValidateAll = async () => {
    const functions: FunctionType[] = ['asr', 'intent', 'summary', 'research']
    for (const func of functions) {
      if (isFunctionConfigured(config, func)) {
        await handleValidate(func)
      }
    }
  }

  // Toggle key visibility
  const toggleKeyVisibility = (provider: Provider) => {
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(provider)) {
      newVisible.delete(provider)
    } else {
      newVisible.add(provider)
    }
    setVisibleKeys(newVisible)
  }

  // Get configuration status
  const getConfigStatus = () => {
    const functions: FunctionType[] = ['asr', 'intent', 'summary', 'research']
    const configured = functions.filter(f => isFunctionConfigured(config, f))
    const validated = functions.filter(f => validations[f].state === 'valid')
    return { configured: configured.length, validated: validated.length, total: functions.length }
  }

  const status = getConfigStatus()
  const providerList = Object.values(PROVIDERS)

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                status.validated === status.total 
                  ? "bg-research/20 text-research" 
                  : status.configured === status.total
                  ? "bg-note/20 text-note"
                  : "bg-muted text-muted-foreground"
              )}>
                {status.validated === status.total ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {status.validated === status.total 
                    ? 'All models validated' 
                    : status.configured === status.total
                    ? `${status.validated}/${status.total} models validated`
                    : `${status.configured}/${status.total} functions configured`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status.validated === status.total 
                    ? 'VoiceAgent is ready to use with real APIs'
                    : status.configured === status.total
                    ? 'Click "Test All" to validate your configuration'
                    : 'Add API keys and models to enable all features'}
                </p>
              </div>
            </div>
            {status.configured === status.total && (
              <Button
                size="sm"
                onClick={handleValidateAll}
                disabled={Object.values(validations).some(v => v.state === 'validating')}
                className="gap-2"
              >
                {Object.values(validations).some(v => v.state === 'validating') ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Test All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'keys' | 'models' | 'calendar')}>
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="keys" className="gap-2 data-[state=active]:bg-background">
            <Key className="w-4 h-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2 data-[state=active]:bg-background">
            <Cpu className="w-4 h-4" />
            Models
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-background">
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {providerList.map(provider => {
                const key = getAPIKey(config, provider.id)
                const isVisible = visibleKeys.has(provider.id)
                const hasKey = !!key

                return (
                  <Card key={provider.id} className={cn(
                    "border transition-colors",
                    hasKey ? "border-research/30 bg-research/5" : "border-border"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                          {hasKey && (
                            <Badge variant="outline" className="text-xs border-research/30 text-research bg-research/10">
                              Connected
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {provider.supportsASR && (
                            <Badge variant="outline" className="text-xs">ASR</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">LLM</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={isVisible ? 'text' : 'password'}
                            placeholder={provider.keyPlaceholder}
                            value={key}
                            onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                            className="pr-10 bg-background font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(provider.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isVisible ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {hasKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleKeyChange(provider.id, '')}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <span className="sr-only">Remove key</span>
                            &times;
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Model Assignment Tab */}
        <TabsContent value="models" className="mt-4 space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {(['asr', 'intent', 'summary', 'research'] as FunctionType[]).map(func => {
                const info = FUNCTION_INFO[func]
                const assignment = getAssignment(config, func)
                const isConfigured = isFunctionConfigured(config, func)
                const validation = validations[func]
                const providerInfo = getProviderInfo(assignment.provider)

                // Get available providers for this function
                const availableProviders = providerList.filter(p => {
                  if (func === 'asr') return p.supportsASR
                  return true
                })

                return (
                  <Card key={func} className={cn(
                    "border transition-colors",
                    validation.state === 'valid' 
                      ? "border-research/30 bg-research/5" 
                      : validation.state === 'invalid'
                      ? "border-destructive/30 bg-destructive/5"
                      : isConfigured 
                      ? "border-note/30 bg-note/5"
                      : "border-border"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{info.name}</CardTitle>
                          {validation.state === 'valid' ? (
                            <Badge variant="outline" className="text-xs border-research/30 text-research bg-research/10">
                              Validated
                            </Badge>
                          ) : validation.state === 'invalid' ? (
                            <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/10">
                              Invalid
                            </Badge>
                          ) : isConfigured ? (
                            <Badge variant="outline" className="text-xs border-note/30 text-note bg-note/10">
                              Not Tested
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Not Configured
                            </Badge>
                          )}
                        </div>
                        {isConfigured && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleValidate(func)}
                            disabled={validation.state === 'validating'}
                            className="h-7 px-2 gap-1 text-xs"
                          >
                            {validation.state === 'validating' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : validation.state === 'valid' ? (
                              <CheckCircle2 className="w-3 h-3 text-research" />
                            ) : validation.state === 'invalid' ? (
                              <XCircle className="w-3 h-3 text-destructive" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Test
                          </Button>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        {info.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Provider Selection */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Provider</label>
                        <div className="relative">
                          <select
                            value={assignment.provider}
                            onChange={(e) => {
                              const newProvider = e.target.value as Provider
                              const newProviderInfo = getProviderInfo(newProvider)
                              const defaultModel = newProviderInfo.defaultModels[func] || ''
                              handleAssignmentChange(func, newProvider, defaultModel)
                            }}
                            className="w-full h-9 px-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {availableProviders.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      {/* Model Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Model Name</label>
                        <Input
                          type="text"
                          placeholder={`e.g., ${providerInfo.defaultModels[func] || 'model-name'}`}
                          value={assignment.model}
                          onChange={(e) => handleAssignmentChange(func, assignment.provider, e.target.value)}
                          className="bg-background font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter the exact model name from {providerInfo.name}
                        </p>
                      </div>

                      {/* Validation Error */}
                      {validation.state === 'invalid' && validation.error && (
                        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{validation.error}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          <CalendarSettings />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      {onClose && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
