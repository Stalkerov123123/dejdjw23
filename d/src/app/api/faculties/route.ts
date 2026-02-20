import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/faculties - Получение списка факультетов
export async function GET() {
  try {
    // Получаем уникальные факультеты из ведомостей
    const faculties = await db.ved.groupBy({
      by: ['faculty'],
      _count: {
        id: true,
      },
      orderBy: {
        faculty: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      faculties: faculties.map((f) => ({
        name: f.faculty,
        vedsCount: f._count.id,
      })),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения факультетов' },
      { status: 500 }
    );
  }
}
