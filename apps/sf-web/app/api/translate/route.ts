import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

import { prisma } from '../../../lib/prisma';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: () => null, // Tắt tự động thử lại kết nối để tránh treo server
});
redis.on('error', (err) => console.error('Redis connection error (ignored during build):', err));

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

    if (model === 'gemini-1.5-flash') {
      model = 'gemini-3.5-flash';
    }

    if (!apiKey) {
      return NextResponse.json({ status: 'error', message: 'Hệ thống chưa được cấp API Key và bạn cũng chưa cấu hình BYOK. Vui lòng vào Dashboard cài đặt AI.' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 1. LLM Caching Strategy: Check Redis Cache
    const contextHash = Buffer.from(contextSentence || "").toString('base64').substring(0, 15);
    const cacheKey = `word:${originalText.toLowerCase()}:${contextHash}`;
    let translationData: string | null = null;
    try {
      translationData = await redis.get(cacheKey);
    } catch (e) {
      console.warn("Bỏ qua cache do lỗi Redis:", e);
    }

    if (!translationData) {
      // 2. Cache Miss -> Call Gemini AI
      const prompt = `
        You are an expert linguist. The user has highlighted the text "${originalText}" in the following context sentence: "${contextSentence}".
        Domain context: ${domain}.
        
        Your tasks:
        1. Detect the language of the highlighted text (e.g., 'en', 'ja', 'zh', 'fr', 'de').
        2. Normalize the text strictly to its root dictionary form (e.g., remove trailing punctuation).
        3. Translate it to Vietnamese contextually.
        
        Return a strict JSON object with EXACTLY these 3 fields:
        - detectedLanguage (string): ISO 639-1 code (e.g., "en", "ja")
        - normalizedWord (string): The clean, dictionary form of the core vocabulary word
        - translatedText (string): Vietnamese translation (natural and context-aware)
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
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });
        
        if (!openAiRes.ok) {
          throw new Error('OpenAI API Error: ' + await openAiRes.text());
        }
        const openAiData = await openAiRes.json();
        translationData = openAiData.choices[0].message.content || "{}";
        
      } else {
        // Handle Gemini via REST API
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
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
        translationData = textResponse || "{}";
      }
      
      try {
        await redis.set(cacheKey, translationData as string, 'EX', 60 * 60 * 24 * 30);
      } catch (e) {
        console.warn("Bỏ qua lưu cache do lỗi Redis");
      }
    }

    let cleanedData = (translationData || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedData);

    return NextResponse.json({ status: 'success', data: parsedData }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Lỗi khi gọi AI: ' + (error.message || 'Hết Token hoặc Key sai') }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
