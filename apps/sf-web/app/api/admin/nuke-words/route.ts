import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized. Vui lòng đăng nhập trên trang chủ.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    
    const result = await prisma.word.deleteMany({
      where: { userId: userId }
    });

    return NextResponse.json({ 
      status: 'success', 
      message: `Đã dọn dẹp thành công ${result.count} từ vựng rác khỏi tài khoản của bạn!` 
    });
  } catch (error) {
    console.error("Lỗi khi xóa từ vựng:", error);
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
