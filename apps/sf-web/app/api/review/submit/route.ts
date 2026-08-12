import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { calculateSM2 } from "../../../../lib/srs";

import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wordId, quality } = await req.json();
    if (!wordId || quality === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const word = await prisma.word.findUnique({
      where: { id: wordId }
    });

    if (!word || word.userId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Word not found or unauthorized' }, { status: 404 });
    }

    // Calculate new SRS parameters
    const srsData = calculateSM2(
      quality, 
      word.repetition, 
      word.easinessFactor, 
      word.interval
    );

    // Update the word
    await prisma.word.update({
      where: { id: wordId },
      data: {
        repetition: srsData.repetition,
        easinessFactor: srsData.easinessFactor,
        interval: srsData.interval,
        nextReviewDate: srsData.nextReviewDate
      }
    });

    return NextResponse.json({ status: 'success', data: srsData });
  } catch (error) {
    console.error("Submit Quiz API Error:", error);
    return NextResponse.json({ status: 'error', message: 'Lỗi cập nhật từ vựng.' }, { status: 500 });
  }
}
