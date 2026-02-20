import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/gradebook/[number] - Получение всех записей для зачётки
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;

    if (!number || number.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Укажите номер зачётки' },
        { status: 400 }
      );
    }

    const records = await db.studentRecord.findMany({
      where: {
        gradebook: number.trim(),
      },
      include: {
        ved: true,
      },
      orderBy: [
        { ved: { year: 'desc' } },
        { ved: { semester: 'desc' } },
      ],
    });

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Зачётка не найдена' },
        { status: 404 }
      );
    }

    // Группируем по году и семестру
    const grouped = records.reduce((acc, record) => {
      const key = `${record.ved.year}-${record.ved.semester}`;
      if (!acc[key]) {
        acc[key] = {
          year: record.ved.year,
          semester: record.ved.semester,
          records: [],
        };
      }
      acc[key].records.push({
        id: record.id,
        subject: record.ved.subject,
        vedType: record.ved.vedType,
        vedId: record.ved.id,
        points1: record.points1,
        points2: record.points2,
        points3: record.points3,
        points4: record.points4,
        totalPoints: record.totalPoints,
        grade: record.grade,
      });
      return acc;
    }, {} as Record<string, { year: string; semester: number; records: unknown[] }>);

    // Общая статистика
    const totalPoints = records.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
    const avgPoints = Math.round(totalPoints / records.length);

    return NextResponse.json({
      success: true,
      gradebook: number,
      records: Object.values(grouped).sort((a, b) => {
        if (a.year !== b.year) return b.year.localeCompare(a.year);
        return b.semester - a.semester;
      }),
      stats: {
        totalRecords: records.length,
        totalPoints,
        avgPoints,
        grades: {
          '5': records.filter(r => r.grade === '5').length,
          '4': records.filter(r => r.grade === '4').length,
          '3': records.filter(r => r.grade === '3').length,
          '2': records.filter(r => r.grade === '2').length,
          'зачёт': records.filter(r => r.grade === 'зачёт').length,
          'незачёт': records.filter(r => r.grade === 'незачёт').length,
        },
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка поиска зачётки' },
      { status: 500 }
    );
  }
}
