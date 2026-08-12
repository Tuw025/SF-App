import { BookOpen, Flame, Clock, Download, Search, LayoutDashboard, LogOut, User as UserIcon, Globe } from 'lucide-react'
import { getServerSession } from "next-auth/next"
import { authOptions } from "./api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import Link from 'next/link'
import AutoRefresh from '../components/auto-refresh'
import WordDetailModal from '../components/word-detail-modal'
import AiSettingsButton from '../components/ai-settings-button'

import { prisma } from '../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string, lang?: string, wordId?: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  
  const params = await searchParams;
  const currentFilter = params.filter || 'all';
  const currentLang = params.lang || 'en';
  const selectedWordId = params.wordId;

  // Build truy vấn (Query) dựa trên Filter và Ngôn ngữ
  const whereClause: any = { userId: userId, language: currentLang };
  
  if (currentFilter === 'due') {
    whereClause.nextReviewDate = { lte: new Date() };
  }

  // Chạy SONG SONG tất cả các truy vấn Database để giảm thời gian chờ từ 6x xuống 1x
  const [dbUser, allWords, words, totalWords, dueWords, selectedWord] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { aiApiKey: true } }),
    prisma.word.findMany({ where: { userId }, select: { createdAt: true, updatedAt: true } }),
    prisma.word.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.word.count({ where: { userId, language: currentLang } }),
    prisma.word.count({ where: { userId, language: currentLang, nextReviewDate: { lte: new Date() } } }),
    selectedWordId ? prisma.word.findUnique({ where: { id: selectedWordId } }) : Promise.resolve(null)
  ]);

  const hasApiKey = !!(dbUser && dbUser.aiApiKey);

  const activeDates = new Set<string>();
  allWords.forEach((w: any) => {
    activeDates.add(w.createdAt.toISOString().split('T')[0] as string);
    activeDates.add(w.updatedAt.toISOString().split('T')[0] as string);
  });

  const uniqueDates = Array.from(activeDates).sort().reverse();
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0] as string;
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0] as string;

  let streak = 0;
  let checkDateStr = todayStr;

  if (uniqueDates.includes(todayStr)) {
    streak = 1;
  } else if (uniqueDates.includes(yesterdayStr)) {
    streak = 1;
    checkDateStr = yesterdayStr;
  }

  if (streak > 0) {
    let currentDate = new Date(checkDateStr);
    while (true) {
      currentDate.setDate(currentDate.getDate() - 1);
      const prevDayStr = currentDate.toISOString().split('T')[0] as string;
      if (uniqueDates.includes(prevDayStr)) {
        streak++;
      } else {
        break;
      }
    }
  }

  return (
    <main className="bg-mesh font-sans min-h-screen pb-20">
      {/* We need state for the Modal. Let's make a wrapper component or just use a small client component for the sidebar settings button... 
          Wait, page.tsx is a Server Component (`async function Dashboard`). We can't use `useState` here.
          Let's create a Client Component for the sidebar or just a small `AiSettingsButton` component. */}
      {selectedWord && <WordDetailModal word={selectedWord} />}
      <AutoRefresh intervalMs={3000} />
      
      <nav className="glass sticky top-0 z-50 py-4 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-2 rounded-xl shadow-lg shadow-blue-500/30">
            <BookOpen className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600">
            Self-Learning
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-slate-200 shadow-sm ml-4 mr-2">
            <UserIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">{session.user.name || session.user.email}</span>
          </div>
          <Link href="/?filter=all" className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-slate-700 hover:bg-white/80 transition shadow-sm border border-slate-200/50">
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </Link>
          <div className="border-l border-slate-200 h-8 mx-2"></div>
          <div className="mr-2">
            <AiSettingsButton />
          </div>
          <a href="/api/auth/signout" className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 shadow-sm transition">
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-8 pt-12">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 text-center mb-4 tracking-tight">
            Welcome, {session.user?.name || 'User'} !!!
          </h1>
          <p className="text-slate-500 text-center max-w-2xl mx-auto mb-12 text-lg">
            Your vocabulary data will automatically sync in real-time. Keep learning and expanding your horizons!
          </p>
        </header>

        {/* Language Tabs */}
        <div className="flex justify-center flex-wrap gap-4 mb-10">
          <Link href={`/?filter=${currentFilter}&lang=en`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'en' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            English
          </Link>
          <Link href={`/?filter=${currentFilter}&lang=ja`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'ja' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            Japanese
          </Link>
          <Link href={`/?filter=${currentFilter}&lang=ko`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'ko' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            Korean
          </Link>
          <Link href={`/?filter=${currentFilter}&lang=zh`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'zh' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            Chinese
          </Link>
          <Link href={`/?filter=${currentFilter}&lang=fr`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'fr' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            French
          </Link>
          <Link href={`/?filter=${currentFilter}&lang=de`} className={`px-6 py-3 rounded-full font-bold transition-all shadow-sm ${currentLang === 'de' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            German
          </Link>
        </div>

        {/* Stats Grid - Clickable Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link href={`/?filter=all&lang=${currentLang}`} className={`glass p-8 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition duration-300 ${currentFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-100 rounded-full blur-2xl group-hover:bg-blue-200 transition"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-blue-50/80 rounded-2xl text-blue-600 shadow-sm border border-blue-100">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-500 font-semibold mb-1">Words Saved</p>
                <h3 className="text-4xl font-black text-slate-800">{totalWords}</h3>
              </div>
            </div>
          </Link>

          <Link href={`/?filter=due&lang=${currentLang}`} className={`glass p-8 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition duration-300 ${currentFilter === 'due' ? 'ring-2 ring-rose-500' : ''}`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-100 rounded-full blur-2xl group-hover:bg-rose-200 transition"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-rose-50/80 rounded-2xl text-rose-600 shadow-sm border border-rose-100">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-500 font-semibold mb-1">Review Due</p>
                <h3 className="text-4xl font-black text-slate-800">{dueWords}</h3>
              </div>
            </div>
          </Link>

          <div className="glass p-8 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition duration-300 cursor-default">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-100 rounded-full blur-2xl group-hover:bg-amber-200 transition"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-amber-50/80 rounded-2xl text-amber-500 shadow-sm border border-amber-100">
                <Flame className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-500 font-semibold mb-1">Streaks 🔥</p>
                <h3 className="text-4xl font-black text-slate-800">{streak} {streak <= 1 ? 'day' : 'days'}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="glass rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50">
          <div className="p-6 border-b border-slate-200/50 bg-white/40 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              {currentFilter === 'due' ? 'Review Due' : 'Your Vocabulary'}
              {currentFilter === 'due' && dueWords > 0 && (
                <Link href={`/review?lang=${currentLang}`} className="ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  <span>🧠 Start Quizlet</span>
                </Link>
              )}
            </h2>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search vocabulary..." 
                  className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white/60 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-72 transition shadow-sm"
                />
              </div>
              <a 
                href={`/api/export/anki?lang=${currentLang}`}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                title="Export these words to an Anki deck (.apkg)"
              >
                <span>📥 Export Anki</span>
              </a>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 backdrop-blur-sm">
                  <th className="px-6 py-4 font-semibold text-slate-500 text-sm uppercase tracking-wider">Vocabulary</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 text-sm uppercase tracking-wider">Pronunciation</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 text-sm uppercase tracking-wider">Meaning</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 text-sm uppercase tracking-wider">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {words.map((word: any) => (
                  <tr key={word.id} className="hover:bg-white/80 transition-colors group">
                    <td className="px-6 py-5">
                      <Link href={`/?filter=${currentFilter}&lang=${currentLang}&wordId=${word.id}`} className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors block">
                        {word.originalText}
                      </Link>
                      {word.partOfSpeech && (
                        <span className="text-xs font-semibold text-slate-500 italic mt-1 block">
                          {word.partOfSpeech}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-mono text-slate-500 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded-md">
                        {word.ipa || '/.../'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-700">
                          {word.englishExplanation ? word.englishExplanation : word.translatedText}
                        </span>
                        {word.englishExplanation && (
                          <span className="text-sm text-slate-400 italic">
                            ({word.translatedText})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-slate-600 italic line-clamp-2 max-w-sm">
                        "{word.contextSentence}"
                      </p>
                    </td>
                  </tr>
                ))}
                {words.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="inline-flex flex-col items-center justify-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                          <BookOpen className="w-12 h-12 text-slate-300" />
                        </div>
                        <p className="text-xl font-semibold text-slate-600">Chưa có từ vựng nào</p>
                        <p className="text-base mt-2 text-slate-500">Hãy dùng Extension bôi đen từ vựng mới để xem dữ liệu nhảy tự động ra đây nhé!</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
