import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/groups - Получение списка групп
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const faculty = searchParams.get('faculty');

    const where: Record<string, unknown> = {};
    if (faculty) where.faculty = faculty;

    // Получаем уникальные группы
    const groups = await db.ved.groupBy({
      by: ['groupName', 'faculty'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        groupName: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      groups: groups.map((g) => ({
        name: g.groupName,
        faculty: g.faculty,
        vedsCount: g._count.id,
      })),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения групп' },
      { status: 500 }
    );
  }
}
