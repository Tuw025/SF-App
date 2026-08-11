"use client"

import { useState } from 'react'
import { Brain } from 'lucide-react'
import AiSettingsModal from './ai-settings-modal'

export default function AiSettingsButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <Brain className="w-5 h-5" />
        <span>Cấu hình AI (BYOK)</span>
      </button>
      
      {isOpen && <AiSettingsModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
