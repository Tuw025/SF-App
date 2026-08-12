import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word') || 'sector';
    const context = searchParams.get('context') || "She brings public sector experience";
    const user = await prisma.user.findFirst({ where: { aiApiKey: { not: null } } });
    if (!user) return NextResponse.json({ error: "No Gemini key found in DB" });
    const apiKey = user.aiApiKey;

    const prompt = `
        You are an expert linguist. The user has highlighted the text "${word}" in the following context sentence: "${context}".
        Domain context: general.
        
        Your tasks:
        1. Detect the language of the highlighted text (e.g., 'en', 'ja', 'zh', 'fr', 'de').
        2. Normalize the text strictly to its root dictionary form (e.g., remove trailing punctuation).
        3. Translate it to Vietnamese contextually.
        
        Return a strict JSON object with EXACTLY these 3 fields:
        - detectedLanguage (string): ISO 639-1 code (e.g., "en", "ja")
        - normalizedWord (string): The clean, dictionary form of the core vocabulary word
        - translatedText (string): Vietnamese translation (natural and context-aware)
      `;
      
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
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

    const status = geminiRes.status;
    let data;
    try {
      data = await geminiRes.json();
    } catch(e) {
      data = await geminiRes.text();
    }

    return NextResponse.json({ status, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
