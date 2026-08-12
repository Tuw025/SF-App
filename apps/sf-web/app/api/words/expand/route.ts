import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const { word, currentContext, language } = await req.json();

    let apiKey = process.env.GEMINI_API_KEY || 'dummy_key';
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

    if (!apiKey || apiKey === 'dummy_key') {
      return NextResponse.json({ status: 'error', message: 'Hệ thống chưa được cấp API Key và bạn cũng chưa cấu hình BYOK. Vui lòng vào Dashboard cài đặt AI.' });
    }

    if (!word || !currentContext) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const prompt = `
      You are an expert ${language} linguist. 
      The user is learning the word "${word}". 
      They already know it in this context: "${currentContext}".
      
      Your task is to demonstrate the POLYSEMY (multiple meanings) of this word.
      Provide 2 to 3 COMPLETELY DIFFERENT meanings/usages of "${word}" that are different from the provided context.
      For each meaning, provide:
      1. An English example sentence (B1-B2 level).
      2. The Vietnamese translation of that sentence.

      Return STRICTLY a JSON array of objects in this exact format:
      [
        {
          "englishSentence": "Example sentence using the new meaning.",
          "vietnameseTranslation": "Bản dịch tiếng Việt của câu ví dụ."
        }
      ]
      
      Do not include any markdown backticks like \`\`\`json in your response, just the raw JSON array.
    `;
    
    let expandData = "{}";
    
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
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });
      
      if (!openAiRes.ok) throw new Error('OpenAI API Error');
      const openAiData = await openAiRes.json();
      expandData = openAiData.choices[0].message.content || "{}";
      
    } else {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const geminiRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!geminiRes.ok) {
        throw new Error('Gemini API Error: ' + await geminiRes.text());
      }

      const geminiData = await geminiRes.json();
      const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      expandData = textResponse || "{}";
    }

    let parsedData: any = [];
    try {
      let cleanedData = expandData.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedData);
    } catch (parseError) {
      console.error("Expand API JSON Parse Error:", parseError, "Raw Data:", expandData);
      throw new Error("Lỗi đọc dữ liệu từ AI. Vui lòng thử lại.");
    }

    return NextResponse.json({ status: 'success', data: parsedData });
  } catch (error) {
    console.error("Expand API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Lỗi sinh ngữ cảnh.' }, { status: 500 });
  }
}
