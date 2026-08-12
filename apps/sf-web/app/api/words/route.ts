import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from '../../../lib/prisma';

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
    const { originalText, translatedText, contextSentence, domain, contextUrl, language } = body;

    if (!originalText || !translatedText) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch user API Key for deep context generation
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredAiModel: true, aiApiKey: true }
    });

    let ipa = "";
    let isIdiom = false;
    let partOfSpeech = null;
    let englishExplanation = null;

    if (dbUser && dbUser.aiApiKey) {
      try {
        const prompt = `
          Analyze this vocabulary word conceptually: "${originalText}"
          Context sentence: "${contextSentence}"
          Translated meaning: "${translatedText}"
          Language: ${language || 'en'}

          Return a strict JSON object with EXACTLY these 4 fields:
          - englishExplanation (string): A simple English explanation of the word's meaning in this specific context, including any grammatical nuances (use A2/B1 level English).
          - partOfSpeech (string): Part of speech (e.g., Noun, Verb, Adjective, etc.)
          - ipa (string): The actual phonetic transcription (e.g., /maɪˈɡreɪʃn/ for English IPA, Romaji for Japanese). DO NOT output placeholders like /.../
          - isIdiom (boolean): true if it's an idiom/phrasal verb
        `;

        let aiResponseData = "{}";

        if (dbUser.preferredAiModel.includes('gpt') || dbUser.preferredAiModel.includes('llama')) {
          const endpoint = dbUser.preferredAiModel.includes('llama') 
            ? 'https://api.groq.com/openai/v1/chat/completions' 
            : 'https://api.openai.com/v1/chat/completions';
            
          const aiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dbUser.aiApiKey}`
            },
            body: JSON.stringify({
              model: dbUser.preferredAiModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              response_format: { type: "json_object" }
            })
          });
          
          if (aiRes.ok) {
            const openAiData = await aiRes.json();
            aiResponseData = openAiData.choices[0].message.content || "{}";
          }
        } else {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${dbUser.preferredAiModel}:generateContent?key=${dbUser.aiApiKey}`;
          
          const geminiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            })
          });

          if (!geminiRes.ok) {
            throw new Error('Gemini API Error: ' + await geminiRes.text());
          }

          const geminiData = await geminiRes.json();
          const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          aiResponseData = textResponse || "{}";
        }

        let cleanedData = aiResponseData.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanedData);
        
        ipa = parsedData.ipa || "";
        isIdiom = parsedData.isIdiom || false;
        partOfSpeech = parsedData.partOfSpeech || null;
        englishExplanation = parsedData.englishExplanation || null;
      } catch (err) {
        console.error("Deep Context AI Error:", err);
      }
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
