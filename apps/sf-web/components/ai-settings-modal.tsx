"use client"

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Key, Brain, Info, Check } from 'lucide-react'

interface AiSettingsModalProps {
  onClose: () => void
}

export default function AiSettingsModal({ onClose }: AiSettingsModalProps) {
  const [model, setModel] = useState('gemini-3.5-flash')
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        if (data.preferredAiModel) setModel(data.preferredAiModel)
        if (data.hasApiKey) {
          setHasApiKey(true)
          setApiKey(data.aiApiKeyMasked)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load settings", err)
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredAiModel: model,
          aiApiKey: apiKey
        })
      })
      
      if (res.ok) {
        setMessage('Lưu cấu hình thành công!')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        const err = await res.json()
        setMessage(err.error || 'Đã có lỗi xảy ra')
      }
    } catch (e) {
      setMessage('Đã có lỗi xảy ra khi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    if (hasApiKey) setHasApiKey(false) // Người dùng bắt đầu nhập mới
  }

  const MODELS = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', type: 'free', desc: 'Nhanh, thông minh', tag: 'Miễn phí', provider: 'Google' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', type: 'free', desc: 'Suy luận sâu, logic tốt', tag: 'Miễn phí', provider: 'Google' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 (Groq)', type: 'free', desc: 'Tốc độ siêu tốc', tag: 'Miễn phí', provider: 'Groq' },
    { id: 'gpt-4o-mini', name: 'ChatGPT-4o Mini', type: 'paid', desc: 'Chất lượng cao', tag: 'Có phí (Rẻ)', provider: 'OpenAI' },
    { id: 'gpt-4o', name: 'ChatGPT-4o', type: 'paid', desc: 'Thông minh nhất', tag: 'Có phí', provider: 'OpenAI' },
  ]

  const selectedModelData = MODELS.find(m => m.id === model)

  const renderInstructions = () => {
    if (!selectedModelData) return null;
    
    if (selectedModelData.provider === 'Google') {
      return (
        <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 space-y-2 border border-slate-200 mt-4">
          <p className="font-semibold text-slate-800">Hướng dẫn lấy API Key của Google (Miễn phí):</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.</li>
            <li>Đăng nhập bằng tài khoản Google của bạn.</li>
            <li>Bấm vào nút <strong>"Create API key"</strong> màu xanh.</li>
            <li>Copy chuỗi khóa (bắt đầu bằng <code>AIzaSy...</code>) và dán vào ô bên dưới.</li>
          </ol>
        </div>
      )
    }
    
    if (selectedModelData.provider === 'Groq') {
      return (
        <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 space-y-2 border border-slate-200 mt-4">
          <p className="font-semibold text-slate-800">Hướng dẫn lấy API Key của Groq (Miễn phí):</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Truy cập <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">GroqCloud Console</a>.</li>
            <li>Đăng nhập hoặc tạo tài khoản mới.</li>
            <li>Bấm nút <strong>"Create API Key"</strong>.</li>
            <li>Copy chuỗi khóa (bắt đầu bằng <code>gsk_...</code>) và dán vào ô bên dưới.</li>
          </ol>
        </div>
      )
    }

    if (selectedModelData.provider === 'OpenAI') {
      return (
        <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 space-y-2 border border-slate-200 mt-4">
          <p className="font-semibold text-slate-800">Hướng dẫn lấy API Key của OpenAI (Trả phí):</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Truy cập <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">OpenAI API Keys</a>.</li>
            <li>Đăng nhập và đảm bảo tài khoản đã nạp tiền (Billing).</li>
            <li>Bấm <strong>"Create new secret key"</strong>.</li>
            <li>Copy chuỗi khóa (bắt đầu bằng <code>sk-proj-...</code>) và dán vào ô bên dưới.</li>
          </ol>
        </div>
      )
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex justify-center p-4 sm:p-6 overflow-hidden">
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Brain className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Cấu hình Bộ não AI</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-sm text-blue-800">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>Mô hình <strong>Bring Your Own Key (BYOK)</strong> giúp bạn sử dụng chính tài khoản AI của mình để phục vụ cho việc học, đảm bảo bảo mật và không bị giới hạn quota chung của hệ thống.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">1. Chọn Mô hình AI (AI Model)</label>
                
                <div className="mb-5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Nhóm Miễn phí (Free)</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {MODELS.filter(m => m.type === 'free').map(m => (
                      <div 
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between h-full ${model === m.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800 text-sm leading-tight">{m.name}</span>
                            {model === m.id && <Check className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed mb-2">{m.desc}</p>
                        </div>
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase w-max tracking-wide">
                          {m.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Nhóm Trả phí (Paid)</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODELS.filter(m => m.type === 'paid').map(m => (
                      <div 
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between h-full ${model === m.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800 text-sm leading-tight">{m.name}</span>
                            {model === m.id && <Check className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed mb-2">{m.desc}</p>
                        </div>
                        <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase w-max tracking-wide">
                          {m.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">2. Nhập API Key cá nhân</label>
                {renderInstructions()}
                <div className="relative mt-3">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder={selectedModelData?.provider === 'Google' ? 'AIzaSy...' : selectedModelData?.provider === 'Groq' ? 'gsk_...' : 'sk-proj-...'}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

            </div>
          )}
        </div>

        <div className="p-5 md:p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center rounded-b-3xl shrink-0">
          <span className={`text-sm font-medium ${message.includes('thành công') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </span>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Đóng
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
