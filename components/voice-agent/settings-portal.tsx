'use client'

import { useState, useEffect } from 'react'
import { Key, Cpu, Check, AlertCircle, ChevronDown, Eye, EyeOff, Sparkles } from 'lucide-react'
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
  type ModelAssignment,
  PROVIDERS,
  FUNCTION_INFO,
  DEFAULT_CONFIG,
  loadAPIConfig,
  saveAPIConfig,
  getAPIKey,
  getAssignment,
  getProvider,
  isFunctionConfigured,
} from '@/lib/api-config'

interface SettingsPortalProps {
  onConfigChange?: (config: UserAPIConfig) => void
  onClose?: () => void
}

export function SettingsPortal({ onConfigChange, onClose }: SettingsPortalProps) {
  const [config, setConfig] = useState<UserAPIConfig>(DEFAULT_CONFIG)
  const [visibleKeys, setVisibleKeys] = useState<Set<Provider>>(new Set())
  const [activeTab, setActiveTab] = useState<'keys' | 'models'>('keys')

  // Load config on mount
  useEffect(() => {
    const loaded = loadAPIConfig()
    setConfig(loaded)
  }, [])

  // Save and notify on config change
  const updateConfig = (newConfig: UserAPIConfig) => {
    setConfig(newConfig)
    saveAPIConfig(newConfig)
    onConfigChange?.(newConfig)
  }

  // Update API key for a provider
  const handleKeyChange = (provider: Provider, key: string) => {
    const newKeys = config.keys.filter(k => k.provider !== provider)
    if (key) {
      newKeys.push({ provider, key })
    }
    updateConfig({ ...config, keys: newKeys })
  }

  // Update model assignment for a function
  const handleAssignmentChange = (func: FunctionType, provider: Provider, model: string) => {
    const newAssignments = config.assignments.map(a => 
      a.function === func ? { function: func, provider, model } : a
    )
    updateConfig({ ...config, assignments: newAssignments })
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
    return { configured: configured.length, total: functions.length }
  }

  const status = getConfigStatus()

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                status.configured === status.total 
                  ? "bg-research/20 text-research" 
                  : "bg-note/20 text-note"
              )}>
                {status.configured === status.total ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {status.configured === status.total 
                    ? 'All functions configured' 
                    : `${status.configured}/${status.total} functions configured`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status.configured === status.total 
                    ? 'VoiceAgent is ready to use'
                    : 'Add API keys to enable all features'}
                </p>
              </div>
            </div>
            {status.configured === status.total && (
              <Badge className="bg-research/20 text-research border-research/30">
                Ready
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'keys' | 'models')}>
        <TabsList className="grid w-full grid-cols-2 bg-secondary">
          <TabsTrigger value="keys" className="gap-2 data-[state=active]:bg-background">
            <Key className="w-4 h-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2 data-[state=active]:bg-background">
            <Cpu className="w-4 h-4" />
            Model Assignment
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {PROVIDERS.map(provider => {
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
                      <CardDescription className="text-xs">
                        {provider.models.length} models available
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={isVisible ? 'text' : 'password'}
                            placeholder={`Enter ${provider.name} API key`}
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
                const currentProvider = getProvider(assignment.provider)

                // Get available providers for this function
                const availableProviders = PROVIDERS.filter(p => {
                  if (func === 'asr') return p.supportsASR
                  return p.models.some(m => m.functions.includes(func))
                })

                return (
                  <Card key={func} className={cn(
                    "border transition-colors",
                    isConfigured ? "border-research/30 bg-research/5" : "border-note/30 bg-note/5"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className={cn(
                            "w-4 h-4",
                            isConfigured ? "text-research" : "text-note"
                          )} />
                          <CardTitle className="text-base">{info.name}</CardTitle>
                          {isConfigured ? (
                            <Badge variant="outline" className="text-xs border-research/30 text-research bg-research/10">
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-note/30 text-note bg-note/10">
                              Needs API Key
                            </Badge>
                          )}
                        </div>
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
                              const providerConfig = getProvider(newProvider)
                              const firstModel = providerConfig?.models.find(m => m.functions.includes(func))
                              if (firstModel) {
                                handleAssignmentChange(func, newProvider, firstModel.id)
                              }
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

                      {/* Model Selection */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Model</label>
                        <div className="relative">
                          <select
                            value={assignment.model}
                            onChange={(e) => handleAssignmentChange(func, assignment.provider, e.target.value)}
                            className="w-full h-9 px-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {currentProvider?.models
                              .filter(m => m.functions.includes(func))
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                        {currentProvider?.models.find(m => m.id === assignment.model) && (
                          <p className="text-xs text-muted-foreground">
                            {currentProvider.models.find(m => m.id === assignment.model)?.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
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
