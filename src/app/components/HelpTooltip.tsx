'use client'

import { useState } from 'react'

interface HelpTooltipProps {
  text: string
  position?: 'top' | 'bottom' | 'right'
  className?: string
}

export function HelpTooltip({ text, position = 'bottom', className = '' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)

  const positionClasses = {
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    bottom: '-top-1 left-1/2 -translate-x-1/2',
    top:    '-bottom-1 left-1/2 -translate-x-1/2',
    right:  '-left-1 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      // Prevent click from bubbling to parent Links
      onClick={(e) => e.stopPropagation()}
    >
      {/* ? icon */}
      <span className="flex h-4 w-4 cursor-default select-none items-center justify-center rounded-full bg-[#E5E5EA] text-[10px] font-bold leading-none text-[#86868B]">
        ?
      </span>

      {/* Tooltip panel */}
      {visible && (
        <div
          className={`absolute z-50 w-72 rounded-xl bg-[#1D1D1F] px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-xl ${positionClasses[position]}`}
          style={{ pointerEvents: 'none' }}
        >
          {/* Arrow */}
          <div
            className={`absolute h-2 w-2 rotate-45 bg-[#1D1D1F] ${arrowClasses[position]}`}
          />
          {text}
        </div>
      )}
    </div>
  )
}
