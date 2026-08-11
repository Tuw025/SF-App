import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function OPTIONS() {
  // CORS configuration cho Extension (nếu cần thiết với Credentials)
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000', // Không dùng * vì có include credentials
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized. Please login first.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { originalText, translatedText, contextSentence, domain, contextUrl, language, ipa, isIdiom, partOfSpeech, englishExplanation } = body;

    if (!originalText || !translatedText) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Check for existing word
    const existingWord = await prisma.word.findFirst({
      where: {
        userId: userId,
        originalText: originalText,
        language: language || "en"
      }
    });

    let word;
    if (existingWord) {
      // Update existing word (bump to top by updating createdAt)
      word = await prisma.word.update({
        where: { id: existingWord.id },
        data: {
          contextSentence: contextSentence || existingWord.contextSentence,
          contextUrl: contextUrl || existingWord.contextUrl,
          createdAt: new Date(),
          translatedText: translatedText, // Might have improved translation
          englishExplanation: englishExplanation || existingWord.englishExplanation,
          ipa: ipa || existingWord.ipa,
          partOfSpeech: partOfSpeech || existingWord.partOfSpeech
        }
      });
    } else {
      // Create new word
      word = await prisma.word.create({
        data: {
          userId,
          originalText,
          translatedText,
          contextSentence: contextSentence || "",
          domain: domain || "",
          contextUrl: contextUrl || "",
          language: language || "en",
          ipa: ipa || "",
          isIdiom: isIdiom || false,
          partOfSpeech: partOfSpeech || null,
          englishExplanation: englishExplanation || null
        }
      });
    }

    return NextResponse.json({ status: 'success', data: word }, {
      headers: { 
        'Access-Control-Allow-Credentials': 'true' 
      }
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
