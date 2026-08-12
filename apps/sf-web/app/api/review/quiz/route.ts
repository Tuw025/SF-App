import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { word, contextSentence, language } = await req.json();

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
      return NextResponse.json({ status: 'error', message: 'Hệ thống chưa được cấp API Key và bạn cũng chưa cấu hình BYOK. Vui lòng vào Dashboard cài đặt AI.' }, { status: 403 });
    }

    if (!word || !contextSentence) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const prompt = `
      You are an expert ${language} teacher.
      The student needs to review the word: "${word}".
      Original context where they found it: "${contextSentence}".
      
      Create a multiple choice question to test their understanding.
      1. Create a natural sentence IN THE TARGET LANGUAGE (${language}) that uses the word "${word}".
      2. IN THAT SENTENCE, you MUST replace the EXACT occurrence of the word "${word}" with exactly four underscores: "____". This is a fill-in-the-blank question, so the sentence MUST contain "____".
      3. The sentence MUST NOT be the original context sentence. Generate a completely NEW sentence.
      4. Provide exactly 4 UNIQUE options. One option MUST be exactly "${word}".
      5. The other 3 options MUST be completely different from each other and different from "${word}". Do NOT generate duplicate options.
      6. The options MUST NOT contain any underscores or punctuation. Just the pure words.
      
      Return STRICTLY a JSON object in this exact format:
      {
        "question": "The sentence with ____ in it",
        "options": [
          "[first wrong word]",
          "[the correct word]",
          "[second wrong word]",
          "[third wrong word]"
        ],
        "correctAnswer": "[the correct word]",
        "explanation": "[Write a brief explanation here in VERY SIMPLE, friendly English (A1-A2 level) about why this is the correct word. THIS MUST BE IN ENGLISH]"
      }
      
      Do not include any markdown backticks like ```json in your response, just the raw JSON object.
    `;
    
    let quizData = "{}";
    
    if (model.includes('gpt') || model.includes('llama')) {
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
      
      if (!openAiRes.ok) throw new Error('OpenAI API Error');
      const openAiData = await openAiRes.json();
      quizData = openAiData.choices[0].message.content || "{}";
      
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });
      quizData = response.text || "{}";
    }
    
    let cleanedData = quizData.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedData);

    // Shuffle options randomly
    parsedData.options = parsedData.options.sort(() => Math.random() - 0.5);

    return NextResponse.json({ status: 'success', data: parsedData });
  } catch (error) {
    console.error("Quiz API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Lỗi sinh câu hỏi từ AI.' }, { status: 500 });
  }
}
