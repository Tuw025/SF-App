import { PrismaClient } from '@prisma/client'
import { getServerSession } from "next-auth/next"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Quizlet from './quizlet'

const prisma = new PrismaClient()

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;

  const params = await searchParams;
  const currentLang = params.lang || 'en';

  // Fetch words that are due for review
  const dueWords = await prisma.word.findMany({
    where: { 
      userId,
      language: currentLang,
      nextReviewDate: { lte: new Date() }
    },
    take: 10, // Max 10 questions per session for good UX
    orderBy: { nextReviewDate: 'asc' }
  }).catch(() => [])

  return (
    <main className="bg-slate-50 font-sans min-h-screen">
      <nav className="glass sticky top-0 z-50 py-4 px-8 border-b border-slate-200 bg-white/70">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-500 hover:text-slate-800 transition">
          <ArrowLeft className="w-5 h-5" /> Trở về Dashboard
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto p-6 pt-12 md:pt-20">
        {dueWords.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-black text-slate-800 mb-4">Bạn đã học xong!</h2>
            <p className="text-slate-500 text-lg">Tuyệt vời! Hiện tại không còn từ vựng nào tới hạn ôn tập. Hãy thư giãn nhé.</p>
            <Link href="/" className="inline-block mt-8 px-6 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition shadow-lg">
              Về trang chủ
            </Link>
          </div>
        ) : (
          <Quizlet words={dueWords} />
        )}
      </div>
    </main>
  )
}
