import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: Request) {
  try {
    // Just find any user with a groq key (starting with gsk_)
    const user = await prisma.user.findFirst({
      where: {
        aiApiKey: { startsWith: 'gsk_' }
      }
    });

    if (!user || !user.aiApiKey) {
      return NextResponse.json({ error: 'No user with groq key found' }, { status: 400 });
    }

    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${user.aiApiKey}` }
    });

    const data = await res.json();
    return NextResponse.json({ models: data.data.map((m: any) => m.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
