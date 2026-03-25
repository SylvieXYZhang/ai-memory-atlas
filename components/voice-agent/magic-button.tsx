'use client'

import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MagicButtonProps {
  onClick: () => void
  isLoading: boolean
  disabled?: boolean
  className?: string
}

export function MagicButton({ onClick, isLoading, disabled, className }: MagicButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      size="lg"
      className={cn(
        "magic-button text-white font-semibold px-8 py-6 text-lg rounded-xl",
        "border-0 shadow-lg",
        "hover:scale-[1.02] active:scale-[0.98] transition-transform",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Researching...
        </>
      ) : (
        <>
          <Sparkles className="w-5 h-5 mr-2" />
          Deep Research
        </>
      )}
    </Button>
  )
}
