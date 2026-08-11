import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
// @ts-ignore
import Exporter from 'anki-apkg-export';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');

    const words = await prisma.word.findMany({
      where: {
        userId: userId,
        ...(lang && lang !== 'all' ? { language: lang } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    if (words.length === 0) {
      return NextResponse.json({ error: 'No words found' }, { status: 404 });
    }

    const apkg = new Exporter(lang ? `SF Vocabulary (${lang.toUpperCase()})` : 'SF Vocabulary');

    words.forEach(word => {
      const front = `<div style="text-align:center; font-size: 24px; padding: 20px;">${word.originalText}</div>`;
      const back = `
        <div style="text-align:center;">
          <h3 style="color: #2563eb;">${word.translatedText}</h3>
          ${word.ipa ? `<p style="color: #64748b;"><i>${word.ipa}</i></p>` : ''}
          ${word.partOfSpeech ? `<p><strong>${word.partOfSpeech}</strong></p>` : ''}
          ${word.englishExplanation ? `<p style="margin-top: 10px;">${word.englishExplanation}</p>` : ''}
          <hr style="margin: 15px 0; border: 0; border-top: 1px solid #e2e8f0;"/>
          <p style="font-style: italic; color: #475569;"><small>${word.contextSentence}</small></p>
        </div>
      `;
      apkg.addCard(front, back);
    });

    const zipBuffer = await apkg.save();

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="SF-Vocabulary${lang && lang !== 'all' ? '-' + lang : ''}.apkg"`,
        'Content-Type': 'application/octet-stream',
      },
    });

  } catch (error) {
    console.error("Anki Export API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Failed to generate Anki deck' }, { status: 500 });
  }
}
