import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredAiModel: true, aiApiKey: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      preferredAiModel: user.preferredAiModel,
      // For security, only return a masked version of the key if it exists
      hasApiKey: !!user.aiApiKey,
      aiApiKeyMasked: user.aiApiKey ? `${user.aiApiKey.substring(0, 4)}...${user.aiApiKey.slice(-4)}` : null
    });
  } catch (error) {
    console.error("GET Settings Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { preferredAiModel, aiApiKey } = await req.json();

    if (!preferredAiModel) {
      return NextResponse.json({ error: 'Missing preferredAiModel' }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = { preferredAiModel };
    
    // Only update API key if it's provided and not masked
    if (aiApiKey !== undefined && !aiApiKey.includes('...')) {
      if (aiApiKey !== "") {
        // Validate the API key before saving
        try {
          let isValid = false;
          if (preferredAiModel.includes('gemini')) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${aiApiKey}`);
            isValid = res.ok;
          } else if (preferredAiModel.includes('llama') || preferredAiModel.includes('qwen')) {
            const res = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': `Bearer ${aiApiKey}` }
            });
            isValid = res.ok;
          } else if (preferredAiModel.includes('gpt')) {
            const res = await fetch('https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${aiApiKey}` }
            });
            isValid = res.ok;
          }
          
          if (!isValid) {
            return NextResponse.json({ error: 'API Key không hợp lệ hoặc không có quyền truy cập.' }, { status: 400 });
          }
        } catch (err) {
          return NextResponse.json({ error: 'Không thể xác thực API Key lúc này. Vui lòng thử lại.' }, { status: 400 });
        }
      }
      updateData.aiApiKey = aiApiKey || null; // Allow clearing the key by sending empty string
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    return NextResponse.json({ status: 'success', message: 'Settings saved successfully' });
  } catch (error) {
    console.error("POST Settings Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
