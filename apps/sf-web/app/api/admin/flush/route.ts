import { NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: () => null,
});

export async function GET() {
  try {
    await redis.flushdb();
    return NextResponse.json({ status: 'success', message: 'Flushed Redis completely!' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
