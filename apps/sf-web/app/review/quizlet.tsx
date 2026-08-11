'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ArrowRight, Brain, Trophy, Loader2 } from 'lucide-react'

interface QuizData {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function Quizlet({ words }: { words: any[] }) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  const currentWord = words[currentIndex]

  useEffect(() => {
    if (words.length === 0) {
      setFinished(true)
      return
    }
    if (currentIndex >= words.length) {
      setFinished(true)
      return
    }

    loadQuizForWord(words[currentIndex])
  }, [currentIndex, words])

  const loadQuizForWord = async (word: any) => {
    setLoading(true)
    setSelectedOption(null)
    try {
      const res = await fetch('/api/review/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.originalText,
          contextSentence: word.contextSentence,
          language: word.language
        })
      })
      const data = await res.json()
      if (data.status === 'success') {
        setQuiz(data.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (opt: string) => {
    if (selectedOption) return // already answered
    setSelectedOption(opt)
    
    const isCorrect = opt === quiz?.correctAnswer;
    if (isCorrect) {
      setScore(s => s + 1)
    }

    // Call API to update SuperMemo SRS nextReviewDate
    try {
      await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: currentWord.id,
          quality: isCorrect ? 5 : 0
        })
      });
    } catch (error) {
      console.error('Failed to submit review', error);
    }
  }

  const handleNext = () => {
    setCurrentIndex(i => i + 1)
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-8">
        <div className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full flex items-center justify-center shadow-2xl shadow-yellow-500/40 mb-6">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-4xl font-black text-slate-800 mb-4">Hoàn thành xuất sắc!</h2>
        <p className="text-xl text-slate-600 mb-8">Bạn đã trả lời đúng {score}/{words.length} câu hỏi ôn tập.</p>
        <button 
          onClick={() => router.push('/')}
          className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-lg hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          Trở về Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
          <Brain className="w-7 h-7 text-indigo-600" />
          Kiểm tra phản xạ
        </h2>
        <div className="bg-white px-5 py-2 rounded-full font-bold text-slate-500 shadow-sm border border-slate-200">
          Câu {currentIndex + 1} / {words.length}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[400px] flex flex-col relative overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p className="font-medium animate-pulse">AI đang chuẩn bị câu hỏi...</p>
          </div>
        ) : quiz ? (
          <>
            <h3 className="text-2xl md:text-3xl font-medium text-slate-800 leading-relaxed mb-10 text-center">
              {quiz.question.split('____').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i !== arr.length - 1 && (
                    <span className="inline-block w-24 border-b-4 border-indigo-200 mx-2 -mb-1"></span>
                  )}
                </span>
              ))}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 flex-1">
              {quiz.options.map((opt, i) => {
                const isSelected = selectedOption === opt;
                const isCorrect = opt === quiz.correctAnswer;
                
                let btnStyle = "bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-700 hover:border-indigo-300";
                
                if (selectedOption) {
                  if (isCorrect) {
                    btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-700 ring-4 ring-emerald-500/20 shadow-lg";
                  } else if (isSelected) {
                    btnStyle = "bg-rose-50 border-rose-500 text-rose-700";
                  } else {
                    btnStyle = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt)}
                    disabled={selectedOption !== null}
                    className={`relative p-5 rounded-2xl text-lg font-bold border-2 transition-all duration-300 flex items-center justify-between ${btnStyle} ${!selectedOption && 'hover:-translate-y-1 hover:shadow-md'}`}
                  >
                    <span>{opt}</span>
                    {selectedOption && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                    {selectedOption && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-rose-500" />}
                  </button>
                )
              })}
            </div>

            {selectedOption && (
              <div className="mt-auto animate-in fade-in slide-in-from-bottom-4">
                <div className={`p-5 rounded-2xl mb-6 ${selectedOption === quiz.correctAnswer ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                  <p className="font-bold mb-1 flex items-center gap-2">
                    {selectedOption === quiz.correctAnswer ? <span className="text-emerald-600">Tuyệt vời! 🎉</span> : <span className="text-rose-600">Sai rồi! Đáp án đúng là {quiz.correctAnswer}</span>}
                  </p>
                  <p className="text-slate-600 text-sm md:text-base">{quiz.explanation}</p>
                </div>
                
                <button 
                  onClick={handleNext}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 group"
                >
                  Câu tiếp theo <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-rose-500 font-medium">
            Có lỗi xảy ra khi load câu hỏi.
          </div>
        )}
      </div>
    </div>
  )
}
