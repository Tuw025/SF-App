'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X, ExternalLink, Sparkles, BookOpen } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function WordDetailModal({ word }: { word: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [extraContexts, setExtraContexts] = useState<{englishSentence: string, vietnameseTranslation: string}[]>([])
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const closeModal = () => {
    // Navigate back to the previous URL without the wordId parameter
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.delete('wordId')
    router.push(currentUrl.pathname + currentUrl.search)
  }

  useEffect(() => {
    let isMounted = true
    setLoadingContexts(true)
    
    fetch('/api/words/expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: word.originalText,
        currentContext: word.contextSentence,
        language: word.language
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!isMounted) return
      if (data.status === 'success' && data.data) {
        setExtraContexts(data.data)
      } else {
        if (data.message?.includes('429') || data.message?.includes('quota')) {
          setErrorMessage("Hệ thống AI đang quá tải (hết Quota miễn phí). Vui lòng thử lại sau 1 phút.");
        } else {
          setErrorMessage("Không thể tạo thêm ngữ cảnh lúc này. Vui lòng thử lại sau.");
        }
      }
    })
    .catch(err => {
      console.error(err)
      if (isMounted) setErrorMessage("Lỗi kết nối đến máy chủ AI. Vui lòng thử lại sau.");
    })
    .finally(() => {
      if (isMounted) setLoadingContexts(false)
    })

    return () => { isMounted = false }
  }, [word.id])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={closeModal}
      ></div>
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 border-b border-slate-200">
          <button 
            onClick={closeModal}
            className="absolute top-6 right-6 p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-end gap-4 mb-3">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">{word.originalText}</h2>
            <div className="flex flex-col gap-1 mb-1">
              {word.partOfSpeech && (
                <span className="text-sm font-semibold text-slate-500 italic px-1">
                  {word.partOfSpeech}
                </span>
              )}
              <span className="text-lg font-mono text-blue-600 bg-blue-100/50 px-3 py-1 rounded-xl">
                {word.ipa || '/.../'}
              </span>
            </div>
          </div>
          <p className="text-xl text-slate-600 font-medium">
            {word.englishExplanation ? (
              <>
                <span className="text-slate-800 font-semibold">{word.translatedText}</span>
                <span className="text-slate-400 mx-2">|</span>
                <span className="italic text-slate-500 text-lg">{word.englishExplanation}</span>
              </>
            ) : (
              word.translatedText
            )}
          </p>
        </div>

        {/* Body */}
        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {/* Original Context */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4" /> Ngữ cảnh gốc đã lưu
            </h3>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="text-lg text-slate-700 italic font-medium leading-relaxed">
                "{word.contextSentence}"
              </p>
              {word.contextUrl && (
                <a 
                  href={word.contextUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> Đọc bài báo gốc
                </a>
              )}
            </div>
          </div>

          {/* AI Generated Contexts */}
          <div>
            <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" /> AI Mở rộng ngữ cảnh
            </h3>
            
            {loadingContexts ? (
              <div className="space-y-4">
                <div className="h-20 bg-slate-100 rounded-2xl animate-pulse"></div>
                <div className="h-20 bg-slate-100 rounded-2xl animate-pulse delay-75"></div>
              </div>
            ) : errorMessage ? (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 text-sm font-medium flex items-center gap-2">
                <span>⚠️</span> {errorMessage}
              </div>
            ) : extraContexts.length > 0 ? (
              <div className="space-y-4">
                {extraContexts.map((ctx, idx) => (
                  <div key={idx} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {ctx.englishSentence}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {ctx.vietnameseTranslation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Không tìm thấy ngữ cảnh bổ sung.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
