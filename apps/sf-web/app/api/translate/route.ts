import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { originalText, contextSentence, domain } = body;

    if (!originalText) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let apiKey = '';
    let model = 'gemini-3.5-flash';
    
    const session = await getServerSession(authOptions);
    if (session && session.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: (session.user as any).id },
        select: { preferredAiModel: true, aiApiKey: true }
      });
      if (dbUser && dbUser.aiApiKey) {
        apiKey = dbUser.aiApiKey;
        model = dbUser.preferredAiModel;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ status: 'error', message: 'Hệ thống chưa được cấp API Key và bạn cũng chưa cấu hình BYOK. Vui lòng vào Dashboard cài đặt AI.' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 1. LLM Caching Strategy: Check Redis Cache
    const contextHash = Buffer.from(contextSentence || "").toString('base64').substring(0, 15);
    const cacheKey = `word:${originalText.toLowerCase()}:${contextHash}`;
    let translationData = await redis.get(cacheKey);

    if (!translationData) {
      // 2. Cache Miss -> Call Gemini AI
      const prompt = `
        You are an expert linguist. The user has highlighted the text "${originalText}" in the following context sentence: "${contextSentence}".
        Domain context: ${domain}.
        
        Your tasks:
        1. Detect the language of the highlighted text (e.g., 'en', 'ja', 'zh', 'fr', 'de').
        2. Normalize the text strictly to its root dictionary form (e.g., remove trailing punctuation, remove grammar particles like 'wa'/'wo' in Japanese, remove conjugation, and extract only the core vocabulary word).
        3. Translate it to Vietnamese contextually.
        
        If the word is an idiom, set isIdiom to true and translate the whole idiom.
        Return a strict JSON object with:
        - detectedLanguage (string): ISO 639-1 code (e.g., "en", "ja", "zh")
        - normalizedWord (string): The clean, dictionary form of the core vocabulary word
        - translatedText (string): Vietnamese translation (natural and context-aware)
        - englishExplanation (string): A simple English explanation of the word's meaning in this specific context, including any grammatical nuances (use A2/B1 level English).
        - partOfSpeech (string): Part of speech (e.g., Noun, Verb, Adjective, etc.)
        - ipa (string): The actual phonetic transcription (e.g., /maɪˈɡreɪʃn/ for English IPA, Romaji for Japanese). DO NOT output placeholders like /.../
        - isIdiom (boolean): true if it's an idiom/phrasal verb
      `;
      
      if (model.includes('gpt') || model.includes('llama')) {
        // Handle OpenAI and Groq (OpenAI Compatible)
        const endpoint = model.includes('llama') 
          ? 'https://api.groq.com/openai/v1/chat/completions' 
          : 'https://api.openai.com/v1/chat/completions';
          
        const openAiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: "json_object" }
          })
        });
        
        if (!openAiRes.ok) {
          throw new Error('OpenAI API Error: ' + await openAiRes.text());
        }
        const openAiData = await openAiRes.json();
        translationData = openAiData.choices[0].message.content || "{}";
        
      } else {
        // Handle Gemini
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: 'application/json'
          }
        });
        translationData = response.text || "{}";
      }
      
      await redis.set(cacheKey, translationData as string, 'EX', 60 * 60 * 24 * 30);
    }

    let cleanedData = (translationData || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedData);

    return NextResponse.json({ status: 'success', data: parsedData }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Lỗi khi gọi AI. Có thể API Key của bạn không hợp lệ hoặc hết tiền.' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
