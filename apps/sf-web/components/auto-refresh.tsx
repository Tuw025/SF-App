"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      // Hàm này yêu cầu Next.js tải lại dữ liệu của Server Component (Dashboard) một cách im lặng
      // Giúp trang web cập nhật từ vựng mới mà không bị nháy trang (no full reload)
      router.refresh();
    }, intervalMs);
    
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null; // Component này chạy ngầm, không render ra UI
}
