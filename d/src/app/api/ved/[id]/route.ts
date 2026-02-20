import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/ved/[id] - Получение ведомости
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ved = await db.ved.findUnique({
      where: { id },
      include: {
        studentRecords: {
          orderBy: {
            gradebook: 'asc',
          },
        },
      },
    });

    if (!ved) {
      return NextResponse.json(
        { success: false, error: 'Ведомость не найдена' },
        { status: 404 }
      );
    }

    // Вычисляем статистику
    const records = ved.studentRecords;
    const stats = {
      total: records.length,
      avgTotal: records.length > 0 
        ? Math.round(records.reduce((sum, r) => sum + (r.totalPoints || 0), 0) / records.length)
        : 0,
      minTotal: records.length > 0 
        ? Math.min(...records.map(r => r.totalPoints || 0))
        : 0,
      maxTotal: records.length > 0 
        ? Math.max(...records.map(r => r.totalPoints || 0))
        : 0,
      grades: {
        '5': records.filter(r => r.grade === '5').length,
        '4': records.filter(r => r.grade === '4').length,
        '3': records.filter(r => r.grade === '3').length,
        '2': records.filter(r => r.grade === '2').length,
        'зачёт': records.filter(r => r.grade === 'зачёт').length,
        'незачёт': records.filter(r => r.grade === 'незачёт').length,
      },
    };

    return NextResponse.json({
      success: true,
      ved: {
        id: ved.id,
        faculty: ved.faculty,
        groupName: ved.groupName,
        course: ved.course,
        year: ved.year,
        semester: ved.semester,
        subject: ved.subject,
        vedType: ved.vedType,
        isClosed: ved.isClosed,
        updatedAt: ved.updatedAt,
        studentRecords: ved.studentRecords.map((r) => ({
          id: r.id,
          gradebook: r.gradebook,
          points1: r.points1,
          points2: r.points2,
          points3: r.points3,
          points4: r.points4,
          totalPoints: r.totalPoints,
          grade: r.grade,
        })),
      },
      stats,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения ведомости' },
      { status: 500 }
    );
  }
}
